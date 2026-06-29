/** Canonical enum literals shared across the domain (match both frontends). */
export type AccountType = 'particulier' | 'professionnel';

export type OrderStatus =
  | 'commande_confirmee'
  | 'en_preparation'
  | 'en_attente_expedition'
  | 'expediee'
  | 'livree';

export type QuoteStatus =
  | 'en_attente_devis'
  | 'devis_envoye'
  | 'devis_accepte'
  | 'devis_rejete';

export type ShippingZone =
  | 'metropole'
  | 'reunion'
  | 'guadeloupe'
  | 'martinique'
  | 'guyane'
  | 'mayotte';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  commande_confirmee: 'Commande confirmée',
  en_preparation: 'En préparation',
  en_attente_expedition: "En attente d'expédition",
  expediee: 'Expédiée',
  livree: 'Livrée',
};

/** Ordered list driving order timelines / steppers. */
export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'commande_confirmee',
  'en_preparation',
  'en_attente_expedition',
  'expediee',
  'livree',
];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  en_attente_devis: 'En attente de devis',
  devis_envoye: 'Devis envoyé',
  devis_accepte: 'Devis accepté',
  devis_rejete: 'Devis refusé',
};

/** Infers the shipping zone from a French postal code (DOM = 97x), else métropole. */
export function territoryFromPostalCode(postalCode?: string): ShippingZone {
  const p = (postalCode ?? '').replace(/\s/g, '');
  if (p.startsWith('971')) return 'guadeloupe';
  if (p.startsWith('972')) return 'martinique';
  if (p.startsWith('973')) return 'guyane';
  if (p.startsWith('974')) return 'reunion';
  if (p.startsWith('976')) return 'mayotte';
  return 'metropole';
}

export const SHIPPING_ZONE_LABELS: Record<ShippingZone, string> = {
  metropole: 'France métropolitaine',
  reunion: 'La Réunion',
  guadeloupe: 'Guadeloupe',
  martinique: 'Martinique',
  guyane: 'Guyane',
  mayotte: 'Mayotte',
};

export function orderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status] ?? status;
}

export function quoteStatusLabel(status: QuoteStatus): string {
  return QUOTE_STATUS_LABELS[status] ?? status;
}

/** metropole keeps the metropole estimate; all DOM-TOM use the outre-mer one. */
export function isOverseas(zone: ShippingZone): boolean {
  return zone !== 'metropole';
}
