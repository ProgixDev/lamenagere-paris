import { formatEUR } from '../../common/serialization/money.util';
import type { ConfigSelectionEntry } from '../catalog/catalog.serializer';
import type { OrderDto, OrderItemDto } from '../orders/orders.serializer';
import type { InvoiceData, InvoiceLineSpec } from './invoice-template';

const TERRITORY_LABELS: Record<string, string> = {
  metropole: 'France métropolitaine',
  reunion: 'La Réunion',
  guadeloupe: 'Guadeloupe',
  martinique: 'Martinique',
  guyane: 'Guyane',
  mayotte: 'Mayotte',
};

function territoryLabel(territory: string): string {
  return TERRITORY_LABELS[territory] ?? territory;
}

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const TIME_FMT = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
});

function trimNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/** Pulls a single display value out of a config-block selection, if it has one worth showing. */
function valueForEntry(entry: ConfigSelectionEntry): string | null {
  if (entry.colors?.length) return entry.colors.map((c) => c.label).join(', ');
  if (entry.opening) return entry.opening.label;
  if (entry.options?.length) return entry.options.map((o) => o.label).join(', ');
  if (entry.accessories?.length) return entry.accessories.map((a) => a.title).join(', ');
  if (entry.shape) return entry.shape.label;
  if (entry.ilot) return entry.ilot.included ? 'Inclus' : null;
  // `layout` and `photos` entries carry no single value worth a chip.
  return null;
}

function specsForItem(item: OrderItemDto): InvoiceLineSpec[] {
  const specs: InvoiceLineSpec[] = [];
  const d = item.customDimensions;
  if (d?.width != null && d?.height != null) {
    specs.push({ label: '', value: `${trimNum(d.width)} × ${trimNum(d.height)} cm` });
  } else if (d?.width != null && d?.length != null) {
    specs.push({ label: '', value: `${trimNum(d.width)} × ${trimNum(d.length)} cm` });
  }
  for (const entry of item.configuration ?? []) {
    const value = valueForEntry(entry);
    if (value) specs.push({ label: entry.label, value });
  }
  return specs;
}

export interface InvoiceBusinessIdentity {
  name: string;
  addressLine: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  siret?: string | null;
  tvaIntracom?: string | null;
}

export interface InvoiceCustomerIdentity {
  name: string;
  addressLines: string[];
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  siret?: string | null;
}

export interface BuildInvoiceDataInput {
  order: OrderDto;
  invoiceNumber: string;
  business: InvoiceBusinessIdentity;
  customer: InvoiceCustomerIdentity;
  /** Truncated/last-4 Stripe payment reference, if available. */
  paymentReference?: string;
}

/**
 * Pure: turns an already-priced, already-paid order into the data the
 * invoice template renders. No IO — the caller resolves settings/profile/
 * Stripe data first. `order.createdAt` doubles as the paid timestamp because
 * an order is only ever created (finalizeDraft) once Stripe has confirmed
 * payment — there is no separate "paid at" moment to track.
 */
export function buildInvoiceData(input: BuildInvoiceDataInput): InvoiceData {
  const { order } = input;
  const paidAt = new Date(order.createdAt);
  const paidDateLabel = `${DATE_FMT.format(paidAt)} à ${TIME_FMT.format(paidAt)}`;
  const paidDateShortLabel = DATE_FMT.format(paidAt).replace(/\//g, ' · ');

  const lines = order.items.map((item) => ({
    name: item.product.name,
    quantity: item.quantity,
    unitPriceLabel: formatEUR(item.price),
    totalLabel: formatEUR(item.price * item.quantity),
    specs: specsForItem(item),
  }));

  return {
    invoiceNumber: input.invoiceNumber,
    orderNumber: order.orderNumber,
    issuedDateLabel: DATE_FMT.format(paidAt),
    paidDateLabel,
    paidDateShortLabel,
    business: {
      name: input.business.name,
      addressLine: input.business.addressLine,
      phone: input.business.phone ?? undefined,
      email: input.business.email ?? undefined,
      website: input.business.website ?? undefined,
      siret: input.business.siret ?? undefined,
      tvaIntracom: input.business.tvaIntracom ?? undefined,
    },
    customer: {
      name: input.customer.name,
      addressLines: input.customer.addressLines,
      phone: input.customer.phone ?? undefined,
      email: input.customer.email ?? undefined,
      company: input.customer.company ?? undefined,
      siret: input.customer.siret ?? undefined,
    },
    payment: {
      method: 'Carte bancaire',
      reference: input.paymentReference,
      deliveryEstimate: order.estimatedDelivery,
      territoryLabel: territoryLabel(order.territory),
    },
    lines,
    totals: {
      subtotalLabel: formatEUR(order.subtotal),
      discountLabel:
        order.discount > 0
          ? `−${formatEUR(order.discount)}${order.promoCode ? ` (${order.promoCode})` : ''}`
          : undefined,
      shippingLabel: order.shippingCost > 0 ? formatEUR(order.shippingCost) : 'Gratuite',
      vat:
        order.vatRate > 0
          ? { rateLabel: `${trimNum(order.vatRate)} %`, amountLabel: formatEUR(order.vat) }
          : undefined,
      exemptionNote: order.vatExemptionNote,
      totalLabel: formatEUR(order.total),
    },
  };
}
