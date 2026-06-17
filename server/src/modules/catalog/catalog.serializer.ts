import {
  centsToEuros,
  formatEUR,
  formatEURFromCents,
} from '../../common/serialization/money.util';

export type ProductType = 'standard' | 'quote_only' | 'configurable';
export type PriceMode = 'fixed' | 'calculated' | 'quote';
export type ProductStatus = 'publie' | 'brouillon' | 'archive';
export type StockLabel = 'en_stock' | 'stock_faible' | 'rupture' | null;

// ── DB row shapes ───────────────────────────────────────────────────────────
export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  icon: string;
  image_url: string | null;
  description: string | null;
  accent_color: string | null;
  parent_id: string | null;
  sort_order: number;
  is_visible: boolean;
  is_featured_home: boolean;
  b2b_only: boolean;
  delivery_override: string | null;
}

export interface ProductMediaRow {
  id: string;
  type: 'image' | 'video';
  url: string;
  sort_order: number;
  is_primary: boolean;
}

export interface ProductRow {
  id: string;
  sku: string | null;
  name: string;
  slug: string;
  description: string;
  short_description: string | null;
  category_id: string;
  product_type: ProductType;
  price_mode: PriceMode;
  status: ProductStatus;
  base_price_cents: number | null;
  width_coef_cents: number | null;
  height_coef_cents: number | null;
  dim_width: number | null;
  dim_height: number | null;
  dim_depth: number | null;
  dim_unit: string | null;
  ref_width: number | null;
  ref_height: number | null;
  ref_unit: string | null;
  min_width: number | null;
  min_height: number | null;
  max_width: number | null;
  max_height: number | null;
  customizable: boolean;
  delivery_metropole: string;
  delivery_outremer: string;
  stock_qty: number | null;
  low_stock_threshold: number | null;
  created_at: string;
  category?: CategoryRow | null;
  media?: ProductMediaRow[];
}

// ── Mobile canonical DTOs (lib/types.ts) ────────────────────────────────────
export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
  icon: string;
  image?: string;
  description?: string;
  productCount?: number;
}

export interface ProductDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: CategoryDto;
  productType: ProductType;
  priceMode: PriceMode;
  price?: number;
  images: string[];
  videos?: string[];
  dimensions?: { width: number; height: number; depth?: number; unit: string };
  referenceDimensions?: { width: number; height: number; unit: string };
  customizable: boolean;
  maxDimensions?: { width: number; height: number };
  deliveryEstimates: { metropole: string; outreMer: string };
  media: { type: 'image' | 'video'; url: string }[];
  createdAt: string;
}

// ── Admin display DTOs (super_admin/src/lib/types.ts) ───────────────────────
export interface AdminProductDto {
  id: string;
  sku: string;
  name: string;
  slug: string;
  category: string;
  productType: ProductType;
  price?: number;
  priceLabel: string;
  stock: StockLabel;
  status: ProductStatus;
  image: string;
}

// ── Serializers ─────────────────────────────────────────────────────────────
export function toCategoryDto(row: CategoryRow, productCount?: number): CategoryDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    icon: row.icon,
    image: row.image_url ?? undefined,
    description: row.description ?? undefined,
    productCount,
  };
}

function sortedMedia(media: ProductMediaRow[] = []): ProductMediaRow[] {
  return [...media].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return a.sort_order - b.sort_order;
  });
}

export function toProductDto(row: ProductRow): ProductDto {
  const media = sortedMedia(row.media);
  const images = media.filter((m) => m.type === 'image').map((m) => m.url);
  const videos = media.filter((m) => m.type === 'video').map((m) => m.url);

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    category: row.category
      ? toCategoryDto(row.category)
      : ({ id: row.category_id, name: '', slug: '', icon: '' } as CategoryDto),
    productType: row.product_type,
    priceMode: row.price_mode,
    price: row.base_price_cents != null ? centsToEuros(row.base_price_cents) : undefined,
    images,
    videos: videos.length ? videos : undefined,
    dimensions:
      row.dim_width != null && row.dim_height != null
        ? {
            width: Number(row.dim_width),
            height: Number(row.dim_height),
            depth: row.dim_depth != null ? Number(row.dim_depth) : undefined,
            unit: row.dim_unit ?? 'cm',
          }
        : undefined,
    referenceDimensions:
      row.ref_width != null && row.ref_height != null
        ? {
            width: Number(row.ref_width),
            height: Number(row.ref_height),
            unit: row.ref_unit ?? 'cm',
          }
        : undefined,
    customizable: row.customizable,
    maxDimensions:
      row.max_width != null && row.max_height != null
        ? { width: Number(row.max_width), height: Number(row.max_height) }
        : undefined,
    deliveryEstimates: {
      metropole: row.delivery_metropole,
      outreMer: row.delivery_outremer,
    },
    media: media.map((m) => ({ type: m.type, url: m.url })),
    createdAt: row.created_at,
  };
}

export function deriveStock(
  qty: number | null,
  threshold: number | null,
): StockLabel {
  if (qty == null) return null;
  if (qty <= 0) return 'rupture';
  if (threshold != null && qty <= threshold) return 'stock_faible';
  return 'en_stock';
}

export function priceLabel(row: ProductRow): string {
  if (row.price_mode === 'quote') return 'Sur devis';
  if (row.base_price_cents == null) return 'Sur devis';
  if (row.price_mode === 'calculated') {
    return `À partir de ${formatEURFromCents(row.base_price_cents)}`;
  }
  return formatEURFromCents(row.base_price_cents);
}

export function toAdminProductDto(row: ProductRow): AdminProductDto {
  const media = sortedMedia(row.media);
  const primary = media.find((m) => m.type === 'image');
  return {
    id: row.id,
    sku: row.sku ?? '',
    name: row.name,
    slug: row.slug,
    category: row.category?.name ?? '',
    productType: row.product_type,
    price: row.base_price_cents != null ? centsToEuros(row.base_price_cents) : undefined,
    priceLabel: priceLabel(row),
    stock: deriveStock(row.stock_qty, row.low_stock_threshold),
    status: row.status,
    image: primary?.url ?? '',
  };
}

// Re-export for admin category responses.
export interface AdminCategoryDto extends CategoryDto {
  accentColor?: string;
  parentId?: string;
  sortOrder: number;
  isVisible: boolean;
  isFeaturedHome: boolean;
  b2bOnly: boolean;
  deliveryOverride?: string;
}

export function toAdminCategoryDto(
  row: CategoryRow,
  productCount?: number,
): AdminCategoryDto {
  return {
    ...toCategoryDto(row, productCount),
    accentColor: row.accent_color ?? undefined,
    parentId: row.parent_id ?? undefined,
    sortOrder: row.sort_order,
    isVisible: row.is_visible,
    isFeaturedHome: row.is_featured_home,
    b2bOnly: row.b2b_only,
    deliveryOverride: row.delivery_override ?? undefined,
  };
}

export const PRODUCT_SELECT =
  'id, sku, name, slug, description, short_description, category_id, product_type, price_mode, status, base_price_cents, width_coef_cents, height_coef_cents, dim_width, dim_height, dim_depth, dim_unit, ref_width, ref_height, ref_unit, min_width, min_height, max_width, max_height, customizable, delivery_metropole, delivery_outremer, stock_qty, low_stock_threshold, created_at, category:categories(*), media:product_media(*)';

export const CATEGORY_SELECT =
  'id, name, slug, icon, image_url, description, accent_color, parent_id, sort_order, is_visible, is_featured_home, b2b_only, delivery_override';

// imported above; re-export so callers have one import site.
export { formatEUR };
