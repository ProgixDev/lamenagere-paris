import type { DimensionRole } from '../../common/pricing/area-formulas';
import {
  centsToEuros,
  formatEUR,
  formatEURFromCents,
} from '../../common/serialization/money.util';
import {
  DEFAULT_AREA_FORMULA,
  type AreaFormulaKey,
} from '../../common/pricing/area-formulas';

export type ProductType = 'standard' | 'quote_only' | 'configurable';
export type PriceMode = 'fixed' | 'calculated' | 'per_sqm' | 'quote';
export type ProductStatus = 'publie' | 'brouillon' | 'archive';
export type StockLabel = 'en_stock' | 'stock_faible' | 'rupture' | null;

// ── Category configuration blocks (templates) ───────────────────────────────
export type ConfigBlockType =
  | 'measurements'
  | 'shape'
  | 'colors'
  | 'accessories'
  | 'opening_details'
  | 'photos'
  | 'options';

export interface ConfigBlockField {
  key: string;
  label: string;
  unit?: string;
  min?: number;
  max?: number;
  /**
   * For per-m² products priced by shape: what this measurement contributes to
   * the billed surface. Untagged fields are recorded but never billed.
   */
  priceRole?: DimensionRole | null;
}

export interface ConfigBlockOption {
  key: string;
  label: string;
  image?: string;
  hex?: string;
  surchargeCents?: number;
  /** Shape options only: how many pans this shape bills (I = 1, L = 2, U = 3). */
  runs?: number | null;
}

export interface ConfigBlockItem {
  id: string;
  title: string;
  image?: string;
  priceCents?: number;
}

export interface ConfigBlock {
  id: string;
  type: ConfigBlockType;
  label: string;
  required?: boolean;
  /** Allow selecting more than one option/item (colors, accessories). */
  multiple?: boolean;
  helpText?: string;
  planImage?: string;
  fields?: ConfigBlockField[];
  options?: ConfigBlockOption[];
  items?: ConfigBlockItem[];
}

// ── Captured selection snapshot (stored on order_items.configuration) ───────
export interface ConfigSelectionEntry {
  blockId: string;
  type: ConfigBlockType;
  label: string;
  measurements?: { key: string; label: string; value: number; unit?: string }[];
  shape?: { key: string; label: string };
  colors?: { key: string; label: string; surchargeCents?: number }[];
  accessories?: { id: string; title: string; priceCents?: number }[];
  opening?: { key: string; label: string; surchargeCents?: number };
  options?: { key: string; label: string; surchargeCents?: number; image?: string }[];
  photos?: { url: string; type: 'image' | 'video' }[];
}
export type ItemConfiguration = ConfigSelectionEntry[];

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
  config_blocks: ConfigBlock[] | null;
}

export interface ProductMediaRow {
  id: string;
  type: 'image' | 'video';
  url: string;
  sort_order: number;
  is_primary: boolean;
}

/** One colour variant of a product, with its own gallery images. */
export interface ProductColorRow {
  key: string;
  name: string;
  hex?: string | null;
  images?: string[] | null;
}

export interface ProductColor {
  key: string;
  name: string;
  hex?: string;
  images: string[];
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
  price_per_sqm_cents: number | null;
  area_formula: AreaFormulaKey | null;
  opening_types: { type: string; surcharge_cents: number }[] | null;
  quality_tiers:
    | { key: string; label: string; price_per_sqm_cents: number }[]
    | null;
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
  /** Units one order may take of a standard product; null = no cap. */
  max_per_order: number | null;
  /** Per-product override of the category's blocks; null = inherit. */
  config_blocks: ConfigBlock[] | null;
  /** Colour variants, each with its own gallery images. */
  colors: ProductColorRow[] | null;
  created_at: string;
  rating_avg: number | string | null;
  rating_count: number | null;
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
  /** Ordered configuration blocks products of this category inherit. */
  configBlocks: ConfigBlock[];
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
  /** €/m² for per_sqm products, so the client can show a live price. */
  pricePerSqm?: number;
  /**
   * Which dimensions a per_sqm product is billed on, and therefore which inputs
   * the app asks for. Always sent for per_sqm products.
   */
  areaFormula?: AreaFormulaKey;
  images: string[];
  videos?: string[];
  dimensions?: { width: number; height: number; depth?: number; unit: string };
  referenceDimensions?: { width: number; height: number; unit: string };
  customizable: boolean;
  minDimensions?: { width: number; height: number };
  maxDimensions?: { width: number; height: number };
  /** Allowed opening types + per-type surcharge (in euros). */
  openingTypes?: { type: string; surcharge: number }[];
  /** Quality tiers for per_sqm products + each tier's €/m² rate (euros). */
  qualityTiers?: { key: string; label: string; pricePerSqm: number }[];
  deliveryEstimates: { metropole: string; outreMer: string };
  media: { type: 'image' | 'video'; url: string }[];
  /** Effective config blocks (product override ?? category template). */
  configBlocks: ConfigBlock[];
  /** Colour variants; selecting one swaps the gallery to its images. */
  colors?: ProductColor[];
  /** Availability label; omitted when the product doesn't track stock. */
  stock?: Exclude<StockLabel, null>;
  /** Units left in stock. Undefined when stock isn't tracked. */
  stockQty?: number;
  /** Units one order may take. Undefined when there's no per-order cap. */
  maxPerOrder?: number;
  createdAt: string;
  /** Average customer rating (0–5) and number of reviews. */
  ratingAvg: number;
  ratingCount: number;
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
    configBlocks: row.config_blocks ?? [],
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
      : ({ id: row.category_id, name: '', slug: '', icon: '', configBlocks: [] } as CategoryDto),
    productType: row.product_type,
    priceMode: row.price_mode,
    price: row.base_price_cents != null ? centsToEuros(row.base_price_cents) : undefined,
    pricePerSqm:
      row.price_per_sqm_cents != null
        ? centsToEuros(row.price_per_sqm_cents)
        : undefined,
    areaFormula:
      row.price_mode === 'per_sqm'
        ? (row.area_formula ?? DEFAULT_AREA_FORMULA)
        : undefined,
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
    minDimensions:
      row.min_width != null && row.min_height != null
        ? { width: Number(row.min_width), height: Number(row.min_height) }
        : undefined,
    maxDimensions:
      row.max_width != null && row.max_height != null
        ? { width: Number(row.max_width), height: Number(row.max_height) }
        : undefined,
    openingTypes:
      row.opening_types && row.opening_types.length
        ? row.opening_types.map((o) => ({
            type: o.type,
            surcharge: centsToEuros(o.surcharge_cents ?? 0),
          }))
        : undefined,
    qualityTiers:
      row.quality_tiers && row.quality_tiers.length
        ? row.quality_tiers.map((t) => ({
            key: t.key,
            label: t.label,
            pricePerSqm: centsToEuros(t.price_per_sqm_cents ?? 0),
          }))
        : undefined,
    deliveryEstimates: {
      metropole: row.delivery_metropole,
      outreMer: row.delivery_outremer,
    },
    media: media.map((m) => ({ type: m.type, url: m.url })),
    // Product override always wins. Inheritance from the category template is
    // for made-to-measure products only: a fixed-price product is bought by
    // the unit, so it must not pick up its category's configuration steps.
    configBlocks: row.config_blocks?.length
      ? row.config_blocks
      : row.price_mode === 'fixed' && row.product_type === 'standard'
        ? []
        : row.category?.config_blocks ?? [],
    colors:
      row.colors && row.colors.length
        ? row.colors.map((c) => ({
            key: c.key,
            name: c.name,
            hex: c.hex ?? undefined,
            images: c.images ?? [],
          }))
        : undefined,
    stock: deriveStock(row.stock_qty, row.low_stock_threshold) ?? undefined,
    stockQty: row.stock_qty ?? undefined,
    maxPerOrder: row.max_per_order ?? undefined,
    createdAt: row.created_at,
    ratingAvg: row.rating_avg != null ? Number(row.rating_avg) : 0,
    ratingCount: row.rating_count ?? 0,
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
  if (row.price_mode === 'per_sqm') {
    // Tiered products advertise their cheapest tier as a starting price.
    if (row.quality_tiers && row.quality_tiers.length) {
      const min = Math.min(
        ...row.quality_tiers.map((t) => t.price_per_sqm_cents ?? 0),
      );
      return `À partir de ${formatEURFromCents(min)}/m²`;
    }
    return row.price_per_sqm_cents != null
      ? `${formatEURFromCents(row.price_per_sqm_cents)}/m²`
      : 'Prix au m²';
  }
  if (row.base_price_cents == null) return '—';
  if (row.price_mode === 'calculated') {
    return `À partir de ${formatEURFromCents(row.base_price_cents)}`;
  }
  return formatEURFromCents(row.base_price_cents);
}

export function toAdminProductDto(row: ProductRow): AdminProductDto {
  const media = sortedMedia(row.media);
  // Products whose gallery only holds a video keep their photos on the colour
  // variants — fall back to those so the list thumbnail is never blank.
  const primary =
    media.find((m) => m.type === 'image')?.url ??
    row.colors?.find((c) => c.images?.length)?.images?.[0];
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
    image: primary ?? '',
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
  'id, sku, name, slug, description, short_description, category_id, product_type, price_mode, status, base_price_cents, width_coef_cents, height_coef_cents, price_per_sqm_cents, area_formula, opening_types, quality_tiers, dim_width, dim_height, dim_depth, dim_unit, ref_width, ref_height, ref_unit, min_width, min_height, max_width, max_height, customizable, delivery_metropole, delivery_outremer, stock_qty, low_stock_threshold, max_per_order, config_blocks, colors, created_at, rating_avg, rating_count, category:categories(*), media:product_media(*)';

export const CATEGORY_SELECT =
  'id, name, slug, icon, image_url, description, accent_color, parent_id, sort_order, is_visible, is_featured_home, b2b_only, delivery_override, config_blocks';

// imported above; re-export so callers have one import site.
export { formatEUR };
