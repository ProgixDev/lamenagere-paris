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

/** cents -> "2 890 €" (French, NNBSP, no decimals). */
export function formatEURFromCents(cents: number): string {
  return formatEUR(centsToEuros(cents));
}

/** euros number -> "2 890 €". */
export function formatEUR(amount: number): string {
  const grouped = amount
    .toLocaleString('fr-FR', { maximumFractionDigits: 0 })
    .replace(/\s| /g, NNBSP);
  return `${grouped}${NNBSP}€`;
}
