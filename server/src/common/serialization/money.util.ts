/**
 * Money helpers. Amounts are stored as integer cents everywhere; euros are
 * only ever produced at serialization time. The admin display string mirrors
 * super_admin/src/lib/format.ts exactly (narrow non-breaking space U+202F,
 * no decimals): "2 890 €".
 */
const NNBSP = ' ';

/** cents -> euros as a number (e.g. 289000 -> 2890). */
export function centsToEuros(cents: number): number {
  return Math.round(cents) / 100;
}

/** euros (number) -> integer cents. */
export function eurosToCents(euros: number): number {
  return Math.round(euros * 100);
}

/** cents -> "2 890 €" or "11,80 €" (French, NNBSP, decimals only when needed). */
export function formatEURFromCents(cents: number): string {
  return formatEUR(centsToEuros(cents));
}

/** euros number -> "2 890 €" or "11,80 €". */
export function formatEUR(amount: number): string {
  const hasCents = Math.round(amount * 100) % 100 !== 0;
  const decimals = hasCents ? 2 : 0;
  const grouped = amount
    .toLocaleString('fr-FR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    .replace(/\s| /g, NNBSP);
  return `${grouped}${NNBSP}€`;
}

