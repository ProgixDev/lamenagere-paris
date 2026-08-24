/**
 * Comparaison de versions sémantiques ("1.2.10") pour le verrou de mise à jour.
 *
 * Volontairement minimal : on ne compare que les composants numériques
 * MAJOR.MINOR.PATCH. Un éventuel suffixe de pré-version ("1.3.0-beta.2") ou un
 * build metadata ("+42") est ignoré — un build interne compte donc comme la
 * version stable correspondante, ce qui est le comportement voulu ici (on ne
 * veut pas bloquer un testeur TestFlight qui a déjà le correctif).
 */

/** Découpe "1.2.10-beta+42" en [1, 2, 10]. `null` si ce n'est pas une version. */
export function parseVersion(raw: string | null | undefined): number[] | null {
  if (typeof raw !== 'string') return null;
  const core = raw.trim().split('+')[0].split('-')[0];
  if (!core) return null;
  const parts = core.split('.');
  const nums: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    nums.push(Number(part));
  }
  return nums.length ? nums : null;
}

/**
 * -1 si a < b, 0 si a == b, 1 si a > b. `null` si l'une des deux est illisible
 * — l'appelant doit alors laisser passer plutôt que de bloquer à l'aveugle.
 */
export function compareVersions(
  a: string | null | undefined,
  b: string | null | undefined,
): -1 | 0 | 1 | null {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  if (!va || !vb) return null;
  const len = Math.max(va.length, vb.length);
  for (let i = 0; i < len; i++) {
    const x = va[i] ?? 0;
    const y = vb[i] ?? 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

/**
 * `true` si la version installée est strictement antérieure au minimum requis.
 * Toute incertitude (version absente, illisible, minimum non configuré) répond
 * `false` : le verrou ne doit jamais enfermer un utilisateur par accident.
 */
export function isBelowMinimum(
  installed: string | null | undefined,
  minimum: string | null | undefined,
): boolean {
  const cmp = compareVersions(installed, minimum);
  return cmp === -1;
}
