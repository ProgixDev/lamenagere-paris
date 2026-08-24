/**
 * French VAT, derived from the delivery postal code.
 *
 * Catalogue prices are stored and displayed HT (hors taxes); VAT is added once,
 * server-side, when the order is created.
 *
 * Goods leaving mainland France for the overseas territories are exports as far
 * as VAT is concerned (CGI art. 294), so those invoices carry no VAT — the
 * customer settles import VAT and octroi de mer with customs on arrival. The
 * exemption is only defensible with proof the goods left the territory, hence
 * `VAT_EXEMPTION_NOTE` being snapshotted onto the order rather than re-derived.
 */

/** Rates in basis points: money never touches a float. 2000 bp = 20 %. */
export const VAT_RATE_BP_METROPOLE = 2000;
export const VAT_RATE_BP_OUTREMER = 0;

export const VAT_EXEMPTION_NOTE =
  'Exonération de TVA — art. 262-I et 294 du CGI (livraison hors du territoire de TVA métropolitain).';

/**
 * Métropole pays the standard rate; everything overseas is exempt.
 *
 * An unreadable or missing postal code falls back to the standard rate: charging
 * VAT we did not owe is refundable, failing to charge VAT we did owe is not.
 */
export function vatRateBpForPostalCode(postalCode?: string | null): number {
  const p = (postalCode ?? '').replace(/\D/g, '');
  // Monaco (980xx) is inside the French VAT territory despite the 98 prefix.
  if (p.startsWith('980')) return VAT_RATE_BP_METROPOLE;
  // 97xxx = DOM + Atlantic COM, 98xxx = Pacific COM.
  if (p.startsWith('97') || p.startsWith('98')) return VAT_RATE_BP_OUTREMER;
  return VAT_RATE_BP_METROPOLE;
}

/** VAT owed on an HT base, rounded to the cent (half away from zero). */
export function vatCentsFor(baseHtCents: number, rateBp: number): number {
  return Math.round((baseHtCents * rateBp) / 10000);
}

export function vatExemptionNoteFor(rateBp: number): string | null {
  return rateBp === 0 ? VAT_EXEMPTION_NOTE : null;
}
