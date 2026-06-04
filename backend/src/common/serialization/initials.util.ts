/**
 * Builds avatar initials from a name, e.g. "Sophie Mercier" -> "SM".
 * Falls back to the first two letters of a single token, or "?".
 */
export function initials(first?: string | null, last?: string | null): string {
  const f = (first ?? '').trim();
  const l = (last ?? '').trim();
  if (f && l) return (f[0] + l[0]).toUpperCase();
  const single = (f || l).trim();
  if (single) return single.slice(0, 2).toUpperCase();
  return '?';
}

/** Initials from a single full-name string ("Jean Laurent" -> "JL"). */
export function initialsFromName(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
