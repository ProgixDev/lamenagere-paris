import { centsToEuros, formatEURFromCents } from '../../common/serialization/money.util';
import { initialsFromName } from '../../common/serialization/initials.util';
import {
  QuoteStatus,
  quoteStatusLabel,
} from '../../common/serialization/status-labels';
import { ProductDto } from '../catalog/catalog.serializer';

export interface QuoteAttachmentRow {
  id: string;
  url: string;
  type: string;
}

export interface QuoteItemRow {
  id: string;
  description: string;
  quantity: number;
  unit_price_cents: number;
  sort_order: number;
}

export interface QuoteProfileRow {
  full_name: string;
  account_type: 'particulier' | 'professionnel';
  company: string | null;
  siret: string | null;
}

export interface QuoteRow {
  id: string;
  quote_number: string | null;
  profile_id: string;
  product_id: string | null;
  product_name: string | null;
  product_image: string | null;
  req_width: number | null;
  req_height: number | null;
  req_depth: number | null;
  notes: string | null;
  status: QuoteStatus;
  quoted_price_cents: number | null;
  shipping_cents: number | null;
  fabrication_delay: string | null;
  validity_days: number | null;
  admin_message: string | null;
  tva_rate: number | null;
  pdf_url: string | null;
  is_b2b: boolean;
  created_at: string;
  attachments?: QuoteAttachmentRow[];
  items?: QuoteItemRow[];
  profile?: QuoteProfileRow | null;
}

// ── Mobile QuoteRequest ─────────────────────────────────────────────────────
export interface QuoteRequestDto {
  id: string;
  product: ProductDto;
  dimensions?: { width: number; height: number };
  notes?: string;
  images?: string[];
  status: QuoteStatus;
  quotedPrice?: number;
  createdAt: string;
}

function stubProduct(row: QuoteRow): ProductDto {
  return {
    id: row.product_id ?? row.id,
    name: row.product_name ?? 'Produit',
    slug: '',
    description: '',
    category: { id: '', name: '', slug: '', icon: '' },
    productType: 'quote_only',
    priceMode: 'quote',
    images: row.product_image ? [row.product_image] : [],
    customizable: true,
    deliveryEstimates: { metropole: '', outreMer: '' },
    media: row.product_image
      ? [{ type: 'image', url: row.product_image }]
      : [],
    createdAt: '',
  };
}

export function toQuoteRequestDto(row: QuoteRow): QuoteRequestDto {
  return {
    id: row.id,
    product: stubProduct(row),
    dimensions:
      row.req_width != null && row.req_height != null
        ? { width: Number(row.req_width), height: Number(row.req_height) }
        : undefined,
    notes: row.notes ?? undefined,
    images: (row.attachments ?? []).map((a) => a.url),
    status: row.status,
    quotedPrice:
      row.quoted_price_cents != null
        ? centsToEuros(row.quoted_price_cents)
        : undefined,
    createdAt: row.created_at,
  };
}

// ── Admin Quote ─────────────────────────────────────────────────────────────
export interface AdminQuoteDto {
  id: string;
  product: string;
  productImage: string;
  client: string;
  b2b?: boolean;
  dimensions?: string;
  status: QuoteStatus;
  statusLabel: string;
  quotedPrice?: string;
  createdAt: string;
  attachments?: number;
}

export function toAdminQuoteDto(row: QuoteRow): AdminQuoteDto {
  const clientName = (row.profile?.full_name ?? '').trim();
  const dims =
    row.req_width != null && row.req_height != null
      ? `${row.req_width} × ${row.req_height} cm`
      : undefined;
  return {
    id: row.quote_number ?? row.id,
    product: row.product_name ?? '',
    productImage: row.product_image ?? '',
    client: clientName || initialsFromName(row.profile?.full_name),
    b2b: row.is_b2b || undefined,
    dimensions: dims,
    status: row.status,
    statusLabel: quoteStatusLabel(row.status),
    quotedPrice:
      row.quoted_price_cents != null
        ? formatEURFromCents(row.quoted_price_cents)
        : undefined,
    createdAt: row.created_at,
    attachments: row.attachments?.length || undefined,
  };
}

export const QUOTE_SELECT =
  '*, attachments:quote_attachments(*), items:quote_items(*), profile:profiles(full_name,account_type,company,siret)';
