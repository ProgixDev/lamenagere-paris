import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { hacherIp } from '../../common/http/ip-hash.util';

/**
 * La limitation de débit sur l'authentification.
 *
 * Voir la migration `0047_auth_rate_limit.sql` pour le pourquoi. En résumé :
 * l'API n'a aucun plafond en dehors de `/leads`, et la boutique web en fait une
 * surface publique.
 *
 * ── Ce qui est compté ──────────────────────────────────────────────────────
 * Les **échecs**, pas les appels. Un client qui se connecte dix fois dans
 * l'heure depuis son bureau et son téléphone n'a rien fait de mal ; dix échecs
 * sur le même compte, si. Et une réussite efface les échecs précédents de cet
 * identifiant, pour qu'une personne qui retrouve son mot de passe au sixième
 * essai ne reste pas bloquée un quart d'heure.
 *
 * ── Deux clés, et pourquoi les deux ────────────────────────────────────────
 * Par **identifiant** : arrête le forçage d'un compte précis.
 * Par **IP** : arrête le balayage — cent comptes essayés une fois chacun ne
 * déclencherait aucun plafond par identifiant.
 */

/** Fenêtres et plafonds. Des échecs, jamais des appels réussis. */
const REGLES = {
  login: {
    fenetreMs: 15 * 60 * 1_000,
    parIdentifiant: 5,
    parIp: 20,
    message:
      'Trop de tentatives de connexion. Réessayez dans une quinzaine de minutes.',
  },
  register: {
    fenetreMs: 60 * 60 * 1_000,
    // Un foyer peut légitimement créer deux comptes ; dix, non.
    parIdentifiant: 3,
    parIp: 5,
    message: 'Trop de créations de compte depuis cette connexion. Réessayez plus tard.',
  },
  forgot: {
    fenetreMs: 60 * 60 * 1_000,
    // Chaque appel envoie un courriel : le plafond protège autant la boîte du
    // client que la réputation du domaine d'envoi.
    parIdentifiant: 3,
    parIp: 10,
    message:
      'Trop de demandes de réinitialisation. Vérifiez vos courriels, puis réessayez plus tard.',
  },
} as const;

export type RouteAuth = keyof typeof REGLES;

/** Une ligne sur cinquante déclenche le ménage. Il n'y a pas d'ordonnanceur. */
const PROBABILITE_PURGE = 0.02;
const RETENTION_MS = 24 * 60 * 60 * 1_000;

@Injectable()
export class AuthThrottleService {
  private readonly logger = new Logger(AuthThrottleService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Normalise puis hache un identifiant.
   *
   * Minuscules et espaces retirés : sans cela `Client@Exemple.fr` et
   * `client@exemple.fr ` seraient deux compteurs différents, et le plafond se
   * contournerait en changeant la casse.
   */
  private hacherIdentifiant(email?: string): string | null {
    if (!email) return null;
    return hacherIp(email.trim().toLowerCase());
  }

  /**
   * Vérifie avant d'agir. Lève une 429 si un plafond est atteint.
   *
   * Ne lève **jamais** pour une raison technique : si la base ne répond pas, on
   * laisse passer. Un limiteur en panne ne doit pas fermer la connexion à toute
   * la clientèle — c'est une protection contre l'abus, pas un contrôle d'accès.
   */
  async verifier(
    route: RouteAuth,
    ip: string | undefined,
    email?: string,
  ): Promise<void> {
    const regle = REGLES[route];
    const depuis = new Date(Date.now() - regle.fenetreMs).toISOString();
    const ipHash = hacherIp(ip);
    const idHash = this.hacherIdentifiant(email);

    if (!ipHash && !idHash) return;

    let parIdentifiant = 0;
    let parIp = 0;
    try {
      [parIdentifiant, parIp] = await Promise.all([
        idHash ? this.compter({ route, depuis, identifierHash: idHash }) : 0,
        ipHash ? this.compter({ route, depuis, ipHash }) : 0,
      ]);
    } catch (e) {
      this.logger.warn(
        `Limiteur indisponible (${route}) : ${(e as Error)?.message}`,
      );
      return;
    }

    if (parIdentifiant >= regle.parIdentifiant || parIp >= regle.parIp) {
      throw new HttpException(regle.message, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  /**
   * Enregistre le résultat.
   *
   * Best-effort de bout en bout : appelé après coup, il ne doit jamais
   * transformer une connexion réussie en erreur.
   */
  async enregistrer(
    route: RouteAuth,
    ip: string | undefined,
    email: string | undefined,
    succeeded: boolean,
  ): Promise<void> {
    const ipHash = hacherIp(ip);
    const idHash = this.hacherIdentifiant(email);
    if (!ipHash && !idHash) return;

    try {
      if (succeeded) {
        // Le compteur de cet identifiant repart à zéro : quelqu'un qui retrouve
        // son mot de passe au sixième essai ne doit pas rester bloqué.
        if (idHash) {
          await this.supabase.client
            .from('auth_attempts')
            .delete()
            .eq('identifier_hash', idHash)
            .eq('route', route)
            .eq('succeeded', false);
        }
        return;
      }

      await this.supabase.client.from('auth_attempts').insert({
        ip_hash: ipHash,
        identifier_hash: idHash,
        route,
        succeeded: false,
      });

      if (Math.random() < PROBABILITE_PURGE) await this.purger();
    } catch (e) {
      this.logger.warn(
        `Journal du limiteur indisponible (${route}) : ${(e as Error)?.message}`,
      );
    }
  }

  private async compter(filtre: {
    route: RouteAuth;
    depuis: string;
    ipHash?: string;
    identifierHash?: string;
  }): Promise<number> {
    let requete = this.supabase.client
      .from('auth_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('route', filtre.route)
      .eq('succeeded', false)
      .gt('created_at', filtre.depuis);

    if (filtre.ipHash) requete = requete.eq('ip_hash', filtre.ipHash);
    if (filtre.identifierHash) {
      requete = requete.eq('identifier_hash', filtre.identifierHash);
    }

    const { count, error } = await requete;
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  /** Les lignes de plus de 24 h ne servent plus à aucune fenêtre. */
  private async purger(): Promise<void> {
    await this.supabase.client
      .from('auth_attempts')
      .delete()
      .lt('created_at', new Date(Date.now() - RETENTION_MS).toISOString());
  }
}
