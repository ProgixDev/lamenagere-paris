export type AccountType = "particulier" | "professionnel";
export type ProductType = "standard" | "quote_only" | "configurable";
export type PriceMode = "fixed" | "calculated" | "per_sqm" | "quote";

export interface OpeningTypeOption {
  type: string;
  /** Surcharge added to the dimension price when this type is chosen (euros). */
  surcharge: number;
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
  | "colors"
  | "accessories"
  | "opening_details"
  | "photos";

export interface ConfigBlockField {
  key: string;
  label: string;
  unit?: string;
  min?: number;
  max?: number;
}
export interface ConfigBlockOption {
  key: string;
  label: string;
  image?: string;
  hex?: string;
  surchargeCents?: number;
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
  multiple?: boolean;
  helpText?: string;
  planImage?: string;
  fields?: ConfigBlockField[];
  options?: ConfigBlockOption[];
  items?: ConfigBlockItem[];
}

// ── Captured selection snapshot (stored on cart + order lines) ──────────────
export interface ConfigSelectionEntry {
  blockId: string;
  type: ConfigBlockType;
  label: string;
  measurements?: { key: string; label: string; value: number; unit?: string }[];
  shape?: { key: string; label: string };
  colors?: { key: string; label: string; surchargeCents?: number }[];
  accessories?: { id: string; title: string; priceCents?: number }[];
  opening?: { key: string; label: string; surchargeCents?: number };
  photos?: { url: string; type: "image" | "video" }[];
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
  /** Allowed opening types + per-type surcharge (euros). */
  openingTypes?: OpeningTypeOption[];
  deliveryEstimates: {
    metropole: string;
    outreMer: string;
  };
  media: { type: "image" | "video"; url: string }[];
  /** Effective config blocks (product override ?? category template). */
  configBlocks?: ConfigBlock[];
  createdAt: string;
}

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  customDimensions?: {
    width: number;
    height: number;
  };
  /** Chosen opening type key (e.g. "coulissante"), when the product offers them. */
  openingType?: string;
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
  customDimensions?: {
    width: number;
    height: number;
  };
  openingType?: string;
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
  openingType?: string;
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
