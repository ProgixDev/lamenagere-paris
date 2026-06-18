export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://api.lamenagereparis.fr/v1";

export const APP_NAME = "La Ménagère Paris";

export const COLORS = {
  primary: "#002444",
  primaryContainer: "#1b3a5c",
  secondary: "#7f5531",
  secondaryContainer: "#ffc69a",
  background: "#f9f9f9",
  surface: "#f9f9f9",
  surfaceContainer: "#eeeeee",
  surfaceContainerLow: "#f3f3f3",
  surfaceContainerLowest: "#ffffff",
  surfaceDim: "#dadada",
  onSurface: "#1a1c1c",
  onSurfaceVariant: "#43474e",
  outline: "#73777f",
  outlineVariant: "#c3c6cf",
  error: "#ba1a1a",
  onPrimary: "#ffffff",
  success: "#10B981",
  warning: "#F59E0B",
} as const;

export const SHIPPING_ZONES = {
  METROPOLE: "metropole",
  REUNION: "reunion",
  GUADELOUPE: "guadeloupe",
  MARTINIQUE: "martinique",
  GUYANE: "guyane",
  MAYOTTE: "mayotte",
} as const;

export const DELIVERY_ESTIMATES = {
  METROPOLE: "2-3 semaines",
  OUTRE_MER: "8-12 semaines",
} as const;

export const PRODUCT_TYPES = {
  STANDARD: "standard",
  QUOTE_ONLY: "quote_only",
  CONFIGURABLE: "configurable",
} as const;

export const PRICE_MODES = {
  FIXED: "fixed",
  CALCULATED: "calculated",
  PER_SQM: "per_sqm",
  QUOTE: "quote",
} as const;

export const ORDER_STATUSES = {
  CONFIRMED: "commande_confirmee",
  PREPARING: "en_preparation",
  AWAITING_SHIPMENT: "en_attente_expedition",
  SHIPPED: "expediee",
  DELIVERED: "livree",
} as const;

export const QUOTE_STATUSES = {
  PENDING: "en_attente_devis",
  SENT: "devis_envoye",
  ACCEPTED: "devis_accepte",
  REJECTED: "devis_rejete",
} as const;

export const ACCOUNT_TYPES = {
  PARTICULIER: "particulier",
  PROFESSIONNEL: "professionnel",
} as const;

// Standard French VAT rate. Catalog prices are stored/displayed TTC (VAT
// included); professional (B2B) accounts see the HT / TVA breakdown.
export const TVA_RATE = 0.2;

export const CATEGORIES = [
  { id: "1", name: "Portes", icon: "door", slug: "portes", description: "Portes d'entrée, intérieures et vitrées" },
  { id: "2", name: "Baies Vitrées", icon: "window-open-variant", slug: "baies-vitrees", description: "Fenêtres et baies coulissantes" },
  { id: "3", name: "Cuisines", icon: "countertop", slug: "cuisines", description: "Cuisines équipées et sur mesure" },
  { id: "4", name: "Canapés & Fauteuils", icon: "sofa", slug: "canapes-fauteuils", description: "Mobilier de salon" },
  { id: "5", name: "Tables à Manger", icon: "table-furniture", slug: "tables-manger", description: "Tables et chaises" },
  { id: "6", name: "Chambres Complètes", icon: "bed", slug: "chambres", description: "Lits, armoires, commodes" },
  { id: "7", name: "Carrelage", icon: "grid", slug: "carrelage", description: "Revêtements et sols" },
  { id: "8", name: "Électroménager", icon: "stove", slug: "electromenager", description: "Équipements de cuisine" },
  { id: "9", name: "Décoration", icon: "lamp", slug: "decoration", description: "Objets et accessoires" },
  { id: "10", name: "Lessive & Entretien", icon: "spray-bottle", slug: "lessive-entretien", description: "Produits d'entretien" },
] as const;

export const TERRITORIES = [
  { label: "France métropolitaine", value: "metropole" },
  { label: "La Réunion", value: "reunion" },
  { label: "Guadeloupe", value: "guadeloupe" },
  { label: "Martinique", value: "martinique" },
  { label: "Guyane", value: "guyane" },
  { label: "Mayotte", value: "mayotte" },
] as const;
