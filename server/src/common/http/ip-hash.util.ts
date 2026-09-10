import { createHash } from 'node:crypto';

/**
 * sha256(ip || LEAD_IP_SALT).
 *
 * An IP address is personal data; a salted digest of it is not reversible and
 * still answers the only question the tables that store it ask — how many
 * requests came from this connection in the last hour.
 *
 * The salt is what makes the digest useless to anyone who obtains the table:
 * without it, the IPv4 space is small enough to enumerate in seconds. Rotating
 * the salt retires the whole rate-limit history at once, which is the intended
 * way to clear it.
 *
 * Shared by `website_leads.ip_hash` (0043) and `website_consents.ip_hash`
 * (0044). It lived in `leads.service.ts` until the second table needed it.
 */
export function hacherIp(ip: string | undefined): string | null {
  if (!ip) return null;
  const sel = process.env.LEAD_IP_SALT ?? '';
  return createHash('sha256').update(`${ip}${sel}`).digest('hex');
}
