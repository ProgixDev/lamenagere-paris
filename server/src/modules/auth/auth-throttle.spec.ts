import { HttpException } from '@nestjs/common';
import { AuthThrottleService } from './auth-throttle.service';

/**
 * La limitation de débit sur l'authentification.
 *
 * Ce qui est vérifié ici, ce sont les décisions du service, pas Postgres : quel
 * plafond s'applique, ce qui remet le compteur à zéro, et — le plus important —
 * ce qui se passe quand la base ne répond pas.
 */

/** Un faux client Supabase qui rend le compte qu'on lui dicte. */
function faireSupabase(options: {
  comptes?: number[];
  leverALaLecture?: boolean;
}) {
  const comptes = [...(options.comptes ?? [])];
  const inserts: Record<string, unknown>[] = [];
  const suppressions: Record<string, unknown>[] = [];

  const requete = () => {
    const filtres: Record<string, unknown> = {};
    const chainable: Record<string, unknown> = {
      eq: (col: string, val: unknown) => {
        filtres[col] = val;
        return chainable;
      },
      gt: () => chainable,
      lt: () => chainable,
      // `await` sur le builder : c'est ainsi que supabase-js exécute.
      then: (resoudre: (v: unknown) => void) => {
        if (options.leverALaLecture) {
          return resoudre({ count: null, error: { message: 'base injoignable' } });
        }
        return resoudre({ count: comptes.shift() ?? 0, error: null });
      },
    };
    return chainable;
  };

  return {
    client: {
      from: () => ({
        select: () => requete(),
        insert: (ligne: Record<string, unknown>) => {
          inserts.push(ligne);
          return Promise.resolve({ error: null });
        },
        delete: () => {
          const f: Record<string, unknown> = {};
          const c: Record<string, unknown> = {
            eq: (col: string, val: unknown) => {
              f[col] = val;
              return c;
            },
            lt: () => c,
            then: (resoudre: (v: unknown) => void) => {
              suppressions.push(f);
              return resoudre({ error: null });
            },
          };
          return c;
        },
      }),
    },
    inserts,
    suppressions,
  };
}

function service(faux: ReturnType<typeof faireSupabase>) {
  return new AuthThrottleService(faux as never);
}

describe('AuthThrottleService', () => {
  it('laisse passer sous le plafond', async () => {
    // 4 échecs sur ce compte, 0 sur l'IP : le plafond login est à 5.
    const faux = faireSupabase({ comptes: [4, 0] });
    await expect(service(faux).verifier('login', '1.2.3.4', 'a@b.fr')).resolves.toBeUndefined();
  });

  it('bloque au plafond par identifiant', async () => {
    const faux = faireSupabase({ comptes: [5, 0] });
    await expect(service(faux).verifier('login', '1.2.3.4', 'a@b.fr')).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('bloque au plafond par IP, même si chaque compte est sous le sien', async () => {
    // Le balayage : cent comptes essayés une fois chacun ne déclencherait
    // aucun plafond par identifiant.
    const faux = faireSupabase({ comptes: [1, 20] });
    await expect(service(faux).verifier('login', '1.2.3.4', 'a@b.fr')).rejects.toThrow(
      /Trop de tentatives/,
    );
  });

  it('applique un plafond plus bas à la création de compte', async () => {
    const faux = faireSupabase({ comptes: [3, 0] });
    await expect(service(faux).verifier('register', '1.2.3.4', 'a@b.fr')).rejects.toThrow(
      /créations de compte/,
    );
  });

  it('laisse passer quand la base ne répond pas', async () => {
    // Un limiteur en panne ne doit pas fermer la connexion à toute la
    // clientèle : c'est une protection contre l'abus, pas un contrôle d'accès.
    const faux = faireSupabase({ leverALaLecture: true });
    await expect(service(faux).verifier('login', '1.2.3.4', 'a@b.fr')).resolves.toBeUndefined();
  });

  it('ne compte rien quand il n’a ni IP ni identifiant', async () => {
    const faux = faireSupabase({ comptes: [999, 999] });
    await expect(service(faux).verifier('login', undefined, undefined)).resolves.toBeUndefined();
  });

  it('enregistre un échec', async () => {
    const faux = faireSupabase({});
    await service(faux).enregistrer('login', '1.2.3.4', 'a@b.fr', false);
    expect(faux.inserts).toHaveLength(1);
    expect(faux.inserts[0]).toMatchObject({ route: 'login', succeeded: false });
  });

  it('efface les échecs du compte après une réussite', async () => {
    // Quelqu'un qui retrouve son mot de passe au sixième essai ne doit pas
    // rester bloqué un quart d'heure.
    const faux = faireSupabase({});
    await service(faux).enregistrer('login', '1.2.3.4', 'a@b.fr', true);
    expect(faux.inserts).toHaveLength(0);
    expect(faux.suppressions).toHaveLength(1);
    expect(faux.suppressions[0]).toMatchObject({ route: 'login', succeeded: false });
  });

  it('ne stocke jamais l’adresse ni le courriel en clair', async () => {
    const faux = faireSupabase({});
    await service(faux).enregistrer('login', '203.0.113.7', 'client@exemple.fr', false);
    const ligne = JSON.stringify(faux.inserts[0]);
    expect(ligne).not.toContain('203.0.113.7');
    expect(ligne).not.toContain('client@exemple.fr');
    // Des empreintes sha256, donc 64 caractères hexadécimaux.
    expect(faux.inserts[0].ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(faux.inserts[0].identifier_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('traite la casse et les espaces comme le même compte', async () => {
    // Sans normalisation, le plafond se contournerait en changeant la casse.
    const faux = faireSupabase({});
    const s = service(faux);
    await s.enregistrer('login', undefined, 'Client@Exemple.FR', false);
    await s.enregistrer('login', undefined, '  client@exemple.fr ', false);
    expect(faux.inserts[0].identifier_hash).toBe(faux.inserts[1].identifier_hash);
  });
});
