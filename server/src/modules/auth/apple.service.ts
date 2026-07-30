import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';

const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
const APPLE_REVOKE_URL = 'https://appleid.apple.com/auth/revoke';

/**
 * Sign in with Apple server-to-server calls.
 *
 * Used for one thing only: Apple requires an app that offers both Sign in with
 * Apple and account deletion to revoke the user's token when the account is
 * deleted. That needs a refresh token, which Apple issues just once in exchange
 * for the authorization code the native sheet hands to the client — so the
 * client posts that code to us right after signing in (see
 * AuthController.linkApple) and we keep the refresh token until deletion.
 *
 * Every method degrades gracefully when the key isn't configured: sign-in keeps
 * working, only revocation is skipped (logged, not thrown), so a missing env var
 * can never block a user from deleting their account.
 */
@Injectable()
export class AppleService {
  private readonly logger = new Logger(AppleService.name);

  constructor(private readonly config: ConfigService) {}

  /** True when the .p8 key and its identifiers are all present. */
  get configured(): boolean {
    return Boolean(
      this.privateKeyPem && this.keyId && this.teamId && this.clientId,
    );
  }

  private get privateKeyPem(): string {
    // Hosting dashboards commonly store multi-line values with escaped \n.
    return (this.config.get<string>('APPLE_SIGNIN_KEY_P8') ?? '')
      .replace(/\\n/g, '\n')
      .trim();
  }
  private get keyId(): string {
    return this.config.get<string>('APPLE_SIGNIN_KEY_ID') ?? '';
  }
  private get teamId(): string {
    return this.config.get<string>('APPLE_SIGNIN_TEAM_ID') ?? '';
  }
  private get clientId(): string {
    return this.config.get<string>('APPLE_SIGNIN_CLIENT_ID') ?? '';
  }

  /**
   * Builds the `client_secret` Apple expects: an ES256 JWT signed with the .p8,
   * issued by the team and scoped to this app. Max lifetime is 6 months; we use
   * a few minutes since it is minted per request.
   */
  private clientSecret(): string {
    const now = Math.floor(Date.now() / 1000);
    const b64 = (o: unknown) =>
      Buffer.from(JSON.stringify(o)).toString('base64url');
    const signingInput =
      `${b64({ alg: 'ES256', kid: this.keyId, typ: 'JWT' })}.` +
      `${b64({
        iss: this.teamId,
        iat: now,
        exp: now + 300,
        aud: 'https://appleid.apple.com',
        sub: this.clientId,
      })}`;
    const signature = crypto.sign(
      'sha256',
      Buffer.from(signingInput),
      {
        key: crypto.createPrivateKey(this.privateKeyPem),
        dsaEncoding: 'ieee-p1363', // JOSE wants raw r||s, not DER
      },
    );
    return `${signingInput}.${signature.toString('base64url')}`;
  }

  /**
   * Exchanges the one-time authorization code from the native sheet for a
   * refresh token. Returns null when unconfigured or rejected by Apple — the
   * caller treats that as "nothing to revoke later".
   */
  async exchangeAuthorizationCode(code: string): Promise<string | null> {
    if (!this.configured) {
      this.logger.warn(
        'APPLE_SIGNIN_* not configured — skipping Apple code exchange',
      );
      return null;
    }
    try {
      const res = await fetch(APPLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret(),
          code,
          grant_type: 'authorization_code',
        }),
      });
      if (!res.ok) {
        this.logger.warn(
          `Apple code exchange failed (${res.status}): ${await res.text()}`,
        );
        return null;
      }
      const json = (await res.json()) as { refresh_token?: string };
      return json.refresh_token ?? null;
    } catch (e) {
      this.logger.warn(`Apple code exchange error: ${String(e)}`);
      return null;
    }
  }

  /**
   * Revokes a refresh token, which invalidates the user's Sign in with Apple
   * grant for this app. Returns whether Apple accepted it; never throws, so a
   * failure here cannot block account deletion.
   */
  async revokeRefreshToken(refreshToken: string): Promise<boolean> {
    if (!this.configured) {
      this.logger.warn(
        'APPLE_SIGNIN_* not configured — cannot revoke Apple token',
      );
      return false;
    }
    try {
      const res = await fetch(APPLE_REVOKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret(),
          token: refreshToken,
          token_type_hint: 'refresh_token',
        }),
      });
      // Apple answers 200 with an empty body on success.
      if (!res.ok) {
        this.logger.warn(
          `Apple revoke failed (${res.status}): ${await res.text()}`,
        );
        return false;
      }
      return true;
    } catch (e) {
      this.logger.warn(`Apple revoke error: ${String(e)}`);
      return false;
    }
  }
}
