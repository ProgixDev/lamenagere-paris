import type { DimensionRole } from "./area-formulas";
import type {
  AreaDimensionKey,
  AreaDimensions,
  AreaFormulaKey,
} from "./area-formulas";
export type AccountType = "particulier" | "professionnel";
export type ProductType = "standard" | "quote_only" | "configurable";

/** Availability of a stock-tracked product, derived server-side. */
export type StockLabel = "en_stock" | "stock_faible" | "rupture";
export type PriceMode = "fixed" | "calculated" | "per_sqm" | "quote";

export interface QualityTierOption {
  key: string;
  label: string;
  /** €/m² rate applied when this tier is selected. */
  pricePerSqm: number;
}

/** One colour variant of a product, with its own gallery images. */
export interface ProductColor {
  key: string;
  name: string;
  /** Swatch colour (e.g. "#ffffff"). Falls back to a neutral dot if absent. */
  hex?: string;
  images: string[];
}
export type ShippingZone = "metropole" | "reunion" | "guadeloupe" | "martinique" | "guyane" | "mayotte";

export type OrderStatus =
  | "commande_confirmee"
  | "en_preparation"
  | "en_attente_expedition"
  | "expediee"
  | "livree";

export type QuoteStatus =
  | "en_attente_devis"
  | "devis_envoye"
  | "devis_accepte"
  | "devis_rejete";

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  accountType: AccountType;
  company?: string;
  siret?: string;
  /** False until the user completes the onboarding flow (mainly OAuth sign-ups). */
  onboarded: boolean;
  addresses: Address[];
  /** Remembered checkout delivery form (pre-fills the next order). */
  deliveryAddress?: {
    firstName: string;
    lastName: string;
    street: string;
    postalCode: string;
    city: string;
    phone?: string;
  };
  createdAt: string;
}

export interface Address {
  id: string;
  firstName: string;
  lastName: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  territory: ShippingZone;
  isDefault?: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  image?: string;
  description?: string;
  productCount?: number;
  /** Configuration blocks (template) products of this category inherit. */
  configBlocks?: ConfigBlock[];
}

// ── Category configuration blocks (templates) ───────────────────────────────
export type ConfigBlockType =
  | "measurements"
  | "shape"
  | "ilot"
  | "colors"
  | "accessories"
  | "opening_details"
  | "photos"
  | "options";

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
  /**
   * `ilot` blocks only: which dimension of the block's own area formula this
   * measurement feeds. Untagged fields are recorded but never billed.
   */
  dimensionKey?: AreaDimensionKey | null;
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
  /**
   * Which products of the category this block is for. One template serves both
   * catalogue (fixed price) and made-to-measure (per m²) products, so a block
   * asking for the customer's own dimensions is skipped on a fixed-price item.
   * Absent means every product.
   */
  appliesTo?: "all" | "sqm" | "fixed";
  multiple?: boolean;
  helpText?: string;
  planImage?: string;
  fields?: ConfigBlockField[];
  options?: ConfigBlockOption[];
  items?: ConfigBlockItem[];
  /**
   * `ilot` blocks only — the island carries its own price, independent of the
   * product's gamme. "fixed" bills `priceCents` flat; "per_sqm" bills the
   * surface built from the tagged fields through `areaFormula`.
   */
  priceMode?: "fixed" | "per_sqm";
  priceCents?: number;
  pricePerSqmCents?: number;
  areaFormula?: AreaFormulaKey;
}

// ── Captured selection snapshot (stored on cart + order lines) ──────────────
export interface ConfigSelectionEntry {
  blockId: string;
  type: ConfigBlockType;
  label: string;
  measurements?: { key: string; label: string; value: number; unit?: string }[];
  shape?: { key: string; label: string; image?: string };
  colors?: { key: string; label: string; surchargeCents?: number; image?: string; hex?: string }[];
  accessories?: { id: string; title: string; priceCents?: number; image?: string }[];
  opening?: { key: string; label: string; surchargeCents?: number; image?: string };
  options?: { key: string; label: string; surchargeCents?: number; image?: string }[];
  photos?: { url: string; type: "image" | "video" }[];
  /** `ilot` blocks: whether the customer wants one, and what it costs. */
  ilot?: { included: boolean; surchargeCents?: number; image?: string };
}
export type ItemConfiguration = ConfigSelectionEntry[];

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: Category;
  productType: ProductType;
  priceMode: PriceMode;
  price?: number;
  /** €/m² for per_sqm products (drives the live price preview). */
  pricePerSqm?: number;
  /**
   * Which dimensions this per_sqm product is billed on, and therefore which
   * inputs the customer is asked for. Defaults to largeur × hauteur.
   */
  areaFormula?: AreaFormulaKey;
  images: string[];
  videos?: string[];
  dimensions?: {
    width: number;
    height: number;
    depth?: number;
    unit: string;
  };
  referenceDimensions?: {
    width: number;
    height: number;
    unit: string;
  };
  customizable: boolean;
  minDimensions?: {
    width: number;
    height: number;
  };
  maxDimensions?: {
    width: number;
    height: number;
  };
  /** Quality tiers for per_sqm products, each with its own €/m² rate. */
  qualityTiers?: QualityTierOption[];
  /** Colour variants; selecting one swaps the gallery to its images. */
  colors?: ProductColor[];
  /** Availability label; absent when the product doesn't track stock. */
  stock?: StockLabel;
  /** Units left in stock. Absent when stock isn't tracked. */
  stockQty?: number;
  /** Units one order may take. Absent when there's no per-order cap. */
  maxPerOrder?: number;
  deliveryEstimates: {
    metropole: string;
    outreMer: string;
  };
  media: { type: "image" | "video"; url: string }[];
  /** Effective config blocks (product override ?? category template). */
  configBlocks?: ConfigBlock[];
  createdAt: string;
  /** Average customer rating (0–5) and number of reviews. */
  ratingAvg?: number;
  ratingCount?: number;
}

export interface ProductReview {
  id: string;
  rating: number;
  comment?: string;
  authorName?: string;
  createdAt: string;
}

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  /** Dimensions entered by the customer; which keys are set depends on the
   *  product's area formula. */
  customDimensions?: AreaDimensions;
  /** Chosen quality tier key, when the product offers tiers. */
  qualityTier?: string;
  /** Captured selections for the category's config blocks. */
  configuration?: ItemConfiguration;
  /** When set, this line comes from an admin-priced devis (fixed price). */
  quoteId?: string;
  calculatedPrice?: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  items: OrderItem[];
  status: OrderStatus;
  total: number;
  subtotal: number;
  shippingCost: number;
  /** Promo discount applied to the subtotal (0 when none). */
  discount?: number;
  /** Applied promo code, if any. */
  promoCode?: string;
  shippingAddress: Address;
  territory: ShippingZone;
  shippingMethod: string;
  estimatedDelivery: string;
  /** Free-text note the buyer left when placing the order. */
  customerNote?: string;
  /** Photos/videos the buyer attached to the order. */
  customerAttachments?: { url: string; type: "image" | "video" }[];
  paymentStatus?: PaymentStatus;
  refundStatus?: RefundStatus;
  refundReason?: string;
  refundDecisionNote?: string;
  refundAmount?: number;
  createdAt: string;
  timeline: OrderTimelineEntry[];
}

export type PaymentStatus = "unpaid" | "paid" | "failed" | "refunded";
export type RefundStatus = "none" | "requested" | "refunded" | "rejected";

export interface OrderItem {
  id: string;
  product: Product;
  quantity: number;
  price: number;
  /** Dimensions entered by the customer; which keys are set depends on the
   *  product's area formula. */
  customDimensions?: AreaDimensions;
  qualityTier?: string;
  configuration?: ItemConfiguration;
}

export interface OrderTimelineEntry {
  status: OrderStatus;
  label: string;
  timestamp?: string;
  note?: string;
  completed: boolean;
}

export interface QuoteRequest {
  id: string;
  product: Product;
  dimensions?: {
    width: number;
    height: number;
  };
  notes?: string;
  images?: string[];
  status: QuoteStatus;
  quotedPrice?: number;
  createdAt: string;
}

export interface Conversation {
  id: string;
  subject: string;
  product?: Product;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  vendorName: string;
  vendorAvatar?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  sender: "user" | "vendor";
  attachments?: { type: string; url: string }[];
  createdAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  hasMore: boolean;
}

// ── Storefront home payload (GET /home) ─────────────────────────────────────
export interface CarouselSlide {
  id: string;
  kind: "image" | "video";
  title: string;
  subtitle?: string;
  mediaUrl: string;
  linkKind: "none" | "category" | "product";
  linkCategoryId?: string;
  linkProductId?: string;
  isActive: boolean;
  position: number;
}

export interface PromoBanner {
  id: string;
  badge?: string;
  title: string;
  subtitle?: string;
  style?: string;
  startsAt?: string;
  endsAt?: string;
  isActive: boolean;
  position: number;
}

export interface HomeData {
  featured: Product[];
  carousel: CarouselSlide[];
  banners: PromoBanner[];
}

// ── Launch pop-ups (GET /popups) ────────────────────────────────────────────
export interface AppPopup {
  id: string;
  title?: string;
  imageUrl: string;
  linkKind: "none" | "category" | "product";
  linkCategoryId?: string;
  linkProductId?: string;
  startsAt?: string;
  endsAt?: string;
  isActive: boolean;
  position: number;
}
