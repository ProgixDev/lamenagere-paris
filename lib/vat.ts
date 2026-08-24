/**
 * Client-side mirror of the server's VAT rules (`server/src/common/tax/vat.ts`).
 *
 * Catalogue prices are HT: the app displays them as-is and only adds VAT in the
 * cart and checkout recaps. The server recomputes everything at order creation —
 * this module exists so the customer sees the same figure before they pay, and
 * both sides must be changed together.
 *
 * Métropole pays 20 %. Anything shipped overseas leaves the French VAT territory
 * (CGI art. 294) and is invoiced exempt; the customer settles import VAT and
 * octroi de mer with customs on arrival.
 */

export const VAT_RATE_METROPOLE = 0.2;
export const VAT_RATE_OUTREMER = 0;

export const VAT_EXEMPTION_NOTE =
  "Livraison hors du territoire de TVA métropolitain : facture exonérée de TVA (art. 262-I et 294 du CGI). Des taxes à l'importation et l'octroi de mer peuvent être dus à la réception.";

/**
 * An unreadable or missing postal code falls back to the standard rate, so the
 * quoted total is never lower than what the server will actually charge.
 */
export const vatRateForPostalCode = (postalCode?: string | null): number => {
  const p = (postalCode ?? "").replace(/\D/g, "");
  // Monaco (980xx) is inside the French VAT territory despite the 98 prefix.
  if (p.startsWith("980")) return VAT_RATE_METROPOLE;
  // 97xxx = DOM + Atlantic COM, 98xxx = Pacific COM.
  if (p.startsWith("97") || p.startsWith("98")) return VAT_RATE_OUTREMER;
  return VAT_RATE_METROPOLE;
};

export interface OrderTotals {
  /** Net taxable base: items − discount + shipping, all HT. */
  ht: number;
  vat: number;
  /** Rate as a fraction (0.2 / 0), for formatting the "TVA (20 %)" label. */
  vatRate: number;
  ttc: number;
  exempt: boolean;
}

/**
 * The one place the app turns HT figures into a payable total. Mirrors the
 * order of operations in `orders.service.ts`: the discount reduces the taxable
 * base before VAT, and shipping is taxed at the same rate as the goods it
 * carries.
 */
export const computeTotals = ({
  subtotalHt,
  shippingHt = 0,
  discountHt = 0,
  postalCode,
}: {
  subtotalHt: number;
  shippingHt?: number;
  discountHt?: number;
  postalCode?: string | null;
}): OrderTotals => {
  const vatRate = vatRateForPostalCode(postalCode);
  const ht = Math.max(0, subtotalHt - discountHt) + shippingHt;
  // Round on the total, not per line — this is how the server computes it.
  const vat = Math.round(ht * vatRate * 100) / 100;
  return { ht, vat, vatRate, ttc: ht + vat, exempt: vatRate === 0 };
};
