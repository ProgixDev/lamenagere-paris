import { centsToEuros, formatEURFromCents } from '../../common/serialization/money.util';
import { initialsFromName } from '../../common/serialization/initials.util';
import {
  OrderStatus,
  ORDER_STATUS_FLOW,
  orderStatusLabel,
  ShippingZone,
} from '../../common/serialization/status-labels';
import { ProductDto } from '../catalog/catalog.serializer';
import { AddressDto } from '../auth/auth.serializer';

// ── Rows ────────────────────────────────────────────────────────────────────
export interface OrderAttachment {
  url: string;
  type: 'image' | 'video';
}

export interface OrderItemRow {
  id: string;
  product_id: string | null;
  product_name: string;
  product_image: string | null;
  quantity: number;
  unit_price_cents: number;
  custom_width: number | null;
  custom_height: number | null;
  opening_type: string | null;
}

export interface OrderTimelineRow {
  status: OrderStatus;
  label: string;
  note: string | null;
  completed: boolean;
  occurred_at: string | null;
}

export interface OrderProfileRow {
  full_name: string;
  account_type: 'particulier' | 'professionnel';
}

export interface OrderRow {
  id: string;
  order_number: string;
  profile_id: string;
  status: OrderStatus;
  payment_status: 'unpaid' | 'paid' | 'failed' | 'refunded';
  subtotal_cents: number;
  shipping_cost_cents: number;
  total_cents: number;
  territory: ShippingZone;
  shipping_method: string;
  estimated_delivery: string;
  ship_first_name: string | null;
  ship_last_name: string | null;
  ship_street: string | null;
  ship_postal_code: string | null;
  ship_city: string | null;
  ship_country: string | null;
  ship_territory: ShippingZone | null;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  is_b2b: boolean;
  customer_note: string | null;
  customer_attachments: OrderAttachment[] | null;
  created_at: string;
  items?: OrderItemRow[];
  timeline?: OrderTimelineRow[];
  profile?: OrderProfileRow | null;
}

// ── Mobile DTOs ─────────────────────────────────────────────────────────────
export interface OrderItemDto {
  id: string;
  product: ProductDto;
  quantity: number;
  price: number;
  customDimensions?: { width: number; height: number };
  openingType?: string;
}

export interface OrderTimelineEntryDto {
  status: OrderStatus;
  label: string;
  timestamp?: string;
  note?: string;
  completed: boolean;
}

export interface OrderDto {
  id: string;
  orderNumber: string;
  items: OrderItemDto[];
  status: OrderStatus;
  paymentStatus: 'unpaid' | 'paid' | 'failed' | 'refunded';
  total: number;
  subtotal: number;
  shippingCost: number;
  shippingAddress: AddressDto;
  territory: ShippingZone;
  shippingMethod: string;
  estimatedDelivery: string;
  customerNote?: string;
  customerAttachments: OrderAttachment[];
  createdAt: string;
  timeline: OrderTimelineEntryDto[];
}

// ── Admin display DTO ───────────────────────────────────────────────────────
export interface AdminOrderDto {
  id: string;
  client: string;
  clientInitials: string;
  b2b?: boolean;
  items: string;
  total: string;
  status: OrderStatus;
  statusLabel: string;
  image: string;
  createdAt: string;
  territory: ShippingZone;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
/** Minimal Product stub built from an order-item snapshot. */
function stubProduct(item: OrderItemRow): ProductDto {
  return {
    id: item.product_id ?? item.id,
    name: item.product_name,
    slug: '',
    description: '',
    category: { id: '', name: '', slug: '', icon: '' },
    productType: 'standard',
    priceMode: 'fixed',
    price: centsToEuros(item.unit_price_cents),
    images: item.product_image ? [item.product_image] : [],
    customizable: false,
    deliveryEstimates: { metropole: '', outreMer: '' },
    media: item.product_image
      ? [{ type: 'image', url: item.product_image }]
      : [],
    createdAt: '',
  };
}

function shippingAddress(row: OrderRow): AddressDto {
  return {
    id: `${row.id}-ship`,
    firstName: row.ship_first_name ?? '',
    lastName: row.ship_last_name ?? '',
    street: row.ship_street ?? '',
    postalCode: row.ship_postal_code ?? '',
    city: row.ship_city ?? '',
    country: row.ship_country ?? 'France',
    territory: row.ship_territory ?? row.territory,
  };
}

/** Build a full 5-step timeline, marking completed steps from stored rows. */
export function buildTimeline(row: OrderRow): OrderTimelineEntryDto[] {
  const stored = new Map(row.timeline?.map((t) => [t.status, t]));
  const currentIndex = ORDER_STATUS_FLOW.indexOf(row.status);
  return ORDER_STATUS_FLOW.map((status, i) => {
    const t = stored.get(status);
    return {
      status,
      label: t?.label ?? orderStatusLabel(status),
      timestamp: t?.occurred_at ?? undefined,
      note: t?.note ?? undefined,
      completed: t?.completed ?? i <= currentIndex,
    };
  });
}

export function toOrderDto(row: OrderRow): OrderDto {
  const items = (row.items ?? []).map<OrderItemDto>((it) => ({
    id: it.id,
    product: stubProduct(it),
    quantity: it.quantity,
    price: centsToEuros(it.unit_price_cents),
    customDimensions:
      it.custom_width != null && it.custom_height != null
        ? { width: Number(it.custom_width), height: Number(it.custom_height) }
        : undefined,
    openingType: it.opening_type ?? undefined,
  }));

  return {
    id: row.id,
    orderNumber: row.order_number,
    items,
    status: row.status,
    paymentStatus: row.payment_status ?? 'unpaid',
    total: centsToEuros(row.total_cents),
    subtotal: centsToEuros(row.subtotal_cents),
    shippingCost: centsToEuros(row.shipping_cost_cents),
    shippingAddress: shippingAddress(row),
    territory: row.territory,
    shippingMethod: row.shipping_method,
    estimatedDelivery: row.estimated_delivery,
    customerNote: row.customer_note ?? undefined,
    customerAttachments: row.customer_attachments ?? [],
    createdAt: row.created_at,
    timeline: buildTimeline(row),
  };
}

export interface TrackingInfo {
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  estimatedDelivery: string;
  status: OrderStatus;
}

export function toTracking(row: OrderRow): TrackingInfo {
  return {
    carrier: row.carrier,
    trackingNumber: row.tracking_number,
    trackingUrl: row.tracking_url,
    estimatedDelivery: row.estimated_delivery,
    status: row.status,
  };
}

export function toAdminOrderDto(row: OrderRow): AdminOrderDto {
  const itemCount = (row.items ?? []).reduce((n, it) => n + it.quantity, 0);
  const clientName = (row.profile?.full_name ?? '').trim();
  const firstImage = (row.items ?? []).find((it) => it.product_image)
    ?.product_image;
  return {
    id: row.order_number,
    client: clientName,
    clientInitials: initialsFromName(row.profile?.full_name),
    b2b: row.is_b2b || undefined,
    items: `${itemCount} article${itemCount > 1 ? 's' : ''}`,
    total: formatEURFromCents(row.total_cents),
    status: row.status,
    statusLabel: orderStatusLabel(row.status),
    image: firstImage ?? '',
    createdAt: row.created_at,
    territory: row.territory,
  };
}

export const ORDER_SELECT =
  '*, items:order_items(*), timeline:order_timeline(*), profile:profiles(full_name,account_type)';
