import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { UserDto } from './auth.serializer';

/**
 * `POST /auth/refresh` — le renouvellement de session.
 *
 * Ce qui est verifie ici n'est pas GoTrue (ce serait tester Supabase) mais les
 * trois decisions qui appartiennent a ce serveur :
 *
 *  1. le nouveau refresh token est bien **remonte au client** — c'est
 *     exactement ce qui manquait a `login`, et la raison pour laquelle une
 *     session mourait au bout d'une heure ;
 *  2. tout echec devient un 401 au message unique, sans distinguer un jeton
 *     revoque d'un jeton inexistant ;
 *  3. `expires_in` absent retombe sur une heure plutot que sur `undefined`,
 *     qu'un client interpreterait comme « expire immediatement ».
 */

const UTILISATEUR = {
  id: 'u-1',
  email: 'client@exemple.fr',
  fullName: 'Client Exemple',
  onboarded: true,
} as unknown as UserDto;

/** Un AuthService avec juste ce que `refresh` touche. */
function service(refreshSession: jest.Mock): AuthService {
  const supabase = { auth: { refreshSession } };
  const instance = new AuthService(
    supabase as never,
    { log: jest.fn() } as never,
    {} as never,
  );
  // `loadUser` est prive et interroge `profiles` ; il n'est pas le sujet.
  jest
    .spyOn(instance as unknown as { loadUser: () => Promise<UserDto> }, 'loadUser')
    .mockResolvedValue(UTILISATEUR);
  return instance;
}

describe('AuthService.refresh', () => {
  it('rend le nouveau couple de jetons, pas seulement l acces', async () => {
    const refreshSession = jest.fn().mockResolvedValue({
      data: {
        session: {
          access_token: 'acces-neuf',
          refresh_token: 'refresh-neuf',
          expires_in: 3600,
        },
        user: { id: 'u-1' },
      },
      error: null,
    });

    const resultat = await service(refreshSession).refresh('refresh-ancien');

    expect(refreshSession).toHaveBeenCalledWith({
      refresh_token: 'refresh-ancien',
    });
    expect(resultat.token).toBe('acces-neuf');
    // Le point de tout l'exercice : les refresh tokens Supabase tournent, donc
    // un client qui ne recoit pas le nouveau ne peut renouveler qu'une fois.
    expect(resultat.refreshToken).toBe('refresh-neuf');
    expect(resultat.refreshToken).not.toBe('refresh-ancien');
    expect(resultat.expiresIn).toBe(3600);
    expect(resultat.user).toBe(UTILISATEUR);
  });

  it('retombe sur une heure quand GoTrue omet expires_in', async () => {
    const refreshSession = jest.fn().mockResolvedValue({
      data: {
        session: { access_token: 'a', refresh_token: 'r' },
        user: { id: 'u-1' },
      },
      error: null,
    });

    const resultat = await service(refreshSession).refresh('r0');
    expect(resultat.expiresIn).toBe(3600);
  });

  it('rend un 401 au message unique quel que soit l echec', async () => {
    const echecs = [
      { data: { session: null, user: null }, error: { message: 'Invalid Refresh Token' } },
      { data: { session: null, user: null }, error: { message: 'Token has expired' } },
      // Pas d'erreur, mais pas de session non plus : possible, et tout aussi
      // inexploitable.
      { data: { session: null, user: null }, error: null },
      { data: { session: { access_token: 'a', refresh_token: 'r' }, user: null }, error: null },
    ];

    for (const reponse of echecs) {
      const svc = service(jest.fn().mockResolvedValue(reponse));
      await expect(svc.refresh('peu-importe')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expect(svc.refresh('peu-importe')).rejects.toThrow(
        'Session expirée, reconnectez-vous',
      );
    }
  });
});
