/**
 * The visitor's real address, which `@Ip()` does not give us.
 *
 * ⚠️ This is working around a defect, not adding a nicety. The `FastifyAdapter`
 * is constructed **without `trustProxy`** in both `main.ts` and `serverless.ts`,
 * so Fastify's `request.ip` — what Nest's `@Ip()` returns — reports the socket
 * address and ignores `x-forwarded-for`. On Vercel every request arrives through
 * the platform proxy and is replayed into Fastify by `api/index.ts`, so `@Ip()`
 * yields **the same internal address for every visitor on earth**. A rate limit
 * keyed on it would throttle the entire internet as one client.
 *
 * `briefs.service.ts` already stores that useless constant in
 * `website_briefs.ip_address` for every row it has ever written.
 *
 * The proper fix is `new FastifyAdapter({ trustProxy: true })`, but that changes
 * `req.ip` for every route at once — including the brief console's audit trail —
 * and deserves its own commit with its own verification. This reads the headers
 * explicitly instead, so the leads endpoint is correct today without moving
 * anything else.
 *
 * Header order matters. `x-vercel-forwarded-for` is set by the platform and
 * cannot be spoofed by the caller; `x-forwarded-for` can be, and is only
 * trustworthy because Vercel overwrites it at the edge. Both are checked before
 * falling back to a value we know to be wrong.
 */

type EnTetes = Record<string, string | string[] | undefined>;

function premier(valeur: string | string[] | undefined): string | undefined {
  if (!valeur) return undefined;
  const brut = Array.isArray(valeur) ? valeur[0] : valeur;
  // `x-forwarded-for` is a comma-separated chain, client first.
  const adresse = brut.split(',')[0]?.trim();
  return adresse && adresse.length > 0 ? adresse : undefined;
}

export function clientIp(enTetes: EnTetes, secours?: string): string | undefined {
  return (
    premier(enTetes['x-vercel-forwarded-for']) ??
    premier(enTetes['x-forwarded-for']) ??
    premier(enTetes['x-real-ip']) ??
    (secours && secours.length > 0 ? secours : undefined)
  );
}
