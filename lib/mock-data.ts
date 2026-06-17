import type { Product, Category } from "./types";

// Real product images from assets
export const PRODUCT_IMAGES = {
  // Portes
  porteGeometrique: require("../assets/la menagere/IMG-20251116-WA0014.jpg"),
  portePrestige: require("../assets/la menagere/InShot_20260408_140933950.jpg"),
  porteContemporaine: require("../assets/la menagere/InShot_20260408_140909018.jpg"),
  porteElegance: require("../assets/la menagere/InShot_20260408_140958614.jpg"),
  portePivotante: require("../assets/la menagere/InShot_20260326_061656000.jpg"),
  porteVague: require("../assets/la menagere/IMG_20260203_024134.jpg"),
  porteLED: require("../assets/la menagere/IMG_20260203_024145.jpg"),
  porteBicolore: require("../assets/la menagere/IMG-20250304-WA0025.jpg"),
  porteArtDeco: require("../assets/la menagere/IMG-20251214-WA0016.jpg"),
  porteFatima: require("../assets/la menagere/IMG_20260406_085207.jpg"),

  // Cuisines
  cuisineIlotChene: require("../assets/la menagere/mmexport1773909383698.jpg"),
  cuisineBlanche: require("../assets/la menagere/InShot_20260404_074237712.jpg"),
  cuisineLuxeIlot: require("../assets/la menagere/IMG-20260318-WA0018.jpg"),
  cuisineGriseL: require("../assets/la menagere/mmexport1773909419843.jpg"),
  cuisineGriseLaquee: require("../assets/la menagere/InShot_20260319_093141170.jpg"),
  cuisineOuverteGrise: require("../assets/la menagere/InShot_20260319_093116884.jpg"),
  cuisineMarbreNoir: require("../assets/la menagere/FB_IMG_1773743531811.jpg"),
  cuisineNoireOr: require("../assets/la menagere/InShot_20260408_075343412.jpg"),
  cuisineArrondie: require("../assets/la menagere/IMG-20260205-WA0007.jpg"),
  cuisineIlotGrise: require("../assets/la menagere/InShot_20260408_075550209.jpg"),

  // Canapés
  canapeModulable: require("../assets/la menagere/FB_IMG_1773743549810.jpg"),
  canapeBordeaux: require("../assets/la menagere/FB_IMG_1773743542000.jpg"),
  salonBicolore: require("../assets/la menagere/FB_IMG_1773743504654.jpg"),
  salonBordeauxTV: require("../assets/la menagere/FB_IMG_1773743547838.jpg"),

  // Chambres
  chambreRoyale: require("../assets/la menagere/1770946539936.png"),
  commodeDoree: require("../assets/la menagere/1770946558773.png"),
  chevetLuxe: require("../assets/la menagere/1770946553405.png"),
  chambreDressing: require("../assets/la menagere/mmexport1770260686245.jpg"),
  dressingWalkIn: require("../assets/la menagere/mmexport1770260677093.jpg"),

  // Baies vitrées
  baieCoulissante: require("../assets/la menagere/IMG-20260317-WA0028.jpg"),
  fenetreVolet: require("../assets/la menagere/IMG-20260317-WA0031.jpg"),

  // Décoration
  buffetMiroir: require("../assets/la menagere/1770946546676.png"),
};

export const MOCK_CATEGORIES: Category[] = [
  { id: "1", name: "Portes", slug: "portes", icon: "door", productCount: 10 },
  { id: "2", name: "Cuisines", slug: "cuisines", icon: "countertop", productCount: 10 },
  { id: "3", name: "Canapés", slug: "canapes", icon: "sofa", productCount: 4 },
  { id: "4", name: "Chambres", slug: "chambres", icon: "bed", productCount: 5 },
  { id: "5", name: "Baies Vitrées", slug: "baies-vitrees", icon: "window-open-variant", productCount: 2 },
  { id: "6", name: "Décoration", slug: "decoration", icon: "lamp", productCount: 1 },
];

// Category card backgrounds (soft pastels like the reference)
export const CATEGORY_BG = [
  "#F5E6DC", // warm peach
  "#E8E0F0", // soft lavender
  "#DCE8E0", // sage green
  "#F0E0E8", // dusty rose
  "#E0E8F0", // powder blue
  "#F0EAD6", // cream
];

export const MOCK_PRODUCTS: Product[] = [
  // -- Portes --
  {
    id: "p1",
    name: "Porte Géométrique Noyer",
    slug: "porte-geometrique-noyer",
    description: "Porte d'entrée blindée en bois de noyer avec motifs géométriques élégants. Double vantail, serrure multipoints haute sécurité.",
    category: MOCK_CATEGORIES[0],
    productType: "configurable",
    priceMode: "calculated",
    price: 3850,
    images: ["porteGeometrique"],
    customizable: true,
    dimensions: { width: 170, height: 210, unit: "cm" },
    deliveryEstimates: { metropole: "2-3 semaines", outreMer: "8-12 semaines" },
    media: [],
    createdAt: "2026-03-01",
  },
  {
    id: "p2",
    name: "Porte Pivotante Luxe 3D",
    slug: "porte-pivotante-luxe",
    description: "Porte pivotante premium avec relief 3D sculptural. Système pivot invisible, finition bois naturel sur cadre aluminium noir.",
    category: MOCK_CATEGORIES[0],
    productType: "quote_only",
    priceMode: "quote",
    images: ["portePivotante"],
    customizable: true,
    dimensions: { width: 120, height: 260, unit: "cm" },
    deliveryEstimates: { metropole: "3-4 semaines", outreMer: "10-14 semaines" },
    media: [],
    createdAt: "2026-02-15",
  },
  {
    id: "p3",
    name: "Porte Noire LED",
    slug: "porte-noire-led",
    description: "Porte d'entrée noire avec bande LED intégrée. Design ultra-moderne, système pivot, ouverture à 180°.",
    category: MOCK_CATEGORIES[0],
    productType: "quote_only",
    priceMode: "quote",
    images: ["porteLED"],
    customizable: true,
    deliveryEstimates: { metropole: "3-4 semaines", outreMer: "10-14 semaines" },
    media: [],
    createdAt: "2026-01-20",
  },
  {
    id: "p4",
    name: "Porte Prestige Noyer",
    slug: "porte-prestige-noyer",
    description: "Porte d'entrée en bois noyer massif avec motifs géométriques noirs. Installation sur façade pierre.",
    category: MOCK_CATEGORIES[0],
    productType: "configurable",
    priceMode: "calculated",
    price: 4200,
    images: ["portePrestige"],
    customizable: true,
    dimensions: { width: 100, height: 220, unit: "cm" },
    deliveryEstimates: { metropole: "2-3 semaines", outreMer: "8-12 semaines" },
    media: [],
    createdAt: "2026-03-10",
  },

  // -- Cuisines --
  {
    id: "c1",
    name: "Cuisine Îlot Chêne Clair",
    slug: "cuisine-ilot-chene",
    description: "Cuisine moderne en L avec îlot central en chêne clair. Plan de travail marbre, hotte intégrée, rangements optimisés.",
    category: MOCK_CATEGORIES[1],
    productType: "quote_only",
    priceMode: "quote",
    images: ["cuisineIlotChene"],
    customizable: true,
    deliveryEstimates: { metropole: "4-6 semaines", outreMer: "12-16 semaines" },
    media: [],
    createdAt: "2026-03-05",
  },
  {
    id: "c2",
    name: "Cuisine Luxe Îlot Arrondi",
    slug: "cuisine-luxe-ilot-arrondi",
    description: "Cuisine de prestige avec îlot arrondi, vitrine noire intégrée, sol marbre et lustre design. Finition laquée blanche.",
    category: MOCK_CATEGORIES[1],
    productType: "quote_only",
    priceMode: "quote",
    images: ["cuisineLuxeIlot"],
    customizable: true,
    deliveryEstimates: { metropole: "6-8 semaines", outreMer: "14-18 semaines" },
    media: [],
    createdAt: "2026-03-18",
  },
  {
    id: "c3",
    name: "Cuisine Noire & Or",
    slug: "cuisine-noire-or",
    description: "Cuisine haut de gamme noire avec accents dorés et bois. Îlot bar avec tabourets crème, four et frigo encastrés.",
    category: MOCK_CATEGORIES[1],
    productType: "quote_only",
    priceMode: "quote",
    images: ["cuisineNoireOr"],
    customizable: true,
    deliveryEstimates: { metropole: "4-6 semaines", outreMer: "12-16 semaines" },
    media: [],
    createdAt: "2026-04-08",
  },
  {
    id: "c4",
    name: "Cuisine Grise Laquée",
    slug: "cuisine-grise-laquee",
    description: "Cuisine grise laquée avec armoires vitrées en bois, four encastré et sol marbre. Élégance et fonctionnalité.",
    category: MOCK_CATEGORIES[1],
    productType: "quote_only",
    priceMode: "quote",
    images: ["cuisineGriseLaquee"],
    customizable: true,
    deliveryEstimates: { metropole: "4-6 semaines", outreMer: "12-16 semaines" },
    media: [],
    createdAt: "2026-03-19",
  },

  // -- Canapés --
  {
    id: "s1",
    name: "Canapé Modulable Bordeaux",
    slug: "canape-modulable-bordeaux",
    description: "Canapé modulable en L, tissu bordeaux premium. Table basse ronde assortie. Mur panneaux 3D décoratifs inclus.",
    category: MOCK_CATEGORIES[2],
    productType: "standard",
    priceMode: "fixed",
    price: 2890,
    images: ["canapeModulable"],
    customizable: false,
    dimensions: { width: 320, height: 95, depth: 180, unit: "cm" },
    deliveryEstimates: { metropole: "2-3 semaines", outreMer: "8-12 semaines" },
    media: [],
    createdAt: "2026-02-10",
  },
  {
    id: "s2",
    name: "Salon Bicolore Crème",
    slug: "salon-bicolore-creme",
    description: "Ensemble salon moderne avec canapé bicolore crème et brun, table basse design et chaise d'appoint assortie.",
    category: MOCK_CATEGORIES[2],
    productType: "standard",
    priceMode: "fixed",
    price: 3450,
    images: ["salonBicolore"],
    customizable: false,
    dimensions: { width: 280, height: 85, depth: 160, unit: "cm" },
    deliveryEstimates: { metropole: "2-3 semaines", outreMer: "8-12 semaines" },
    media: [],
    createdAt: "2026-01-15",
  },

  // -- Chambres --
  {
    id: "ch1",
    name: "Chambre Royale Blanche & Or",
    slug: "chambre-royale-blanche-or",
    description: "Chambre complète luxe : lit king-size, chevets miroir, commode et suspensions. Finitions blanches et dorées.",
    category: MOCK_CATEGORIES[3],
    productType: "standard",
    priceMode: "fixed",
    price: 5890,
    images: ["chambreRoyale"],
    customizable: false,
    deliveryEstimates: { metropole: "3-4 semaines", outreMer: "10-14 semaines" },
    media: [],
    createdAt: "2026-02-20",
  },
  {
    id: "ch2",
    name: "Dressing Walk-In Bois",
    slug: "dressing-walk-in",
    description: "Dressing walk-in luxe en bois foncé avec îlot central, rangements ouverts et éclairage plafond intégré.",
    category: MOCK_CATEGORIES[3],
    productType: "quote_only",
    priceMode: "quote",
    images: ["dressingWalkIn"],
    customizable: true,
    deliveryEstimates: { metropole: "4-6 semaines", outreMer: "12-16 semaines" },
    media: [],
    createdAt: "2026-01-10",
  },

  // -- Décoration --
  {
    id: "d1",
    name: "Buffet Miroir Triptyque",
    slug: "buffet-miroir-triptyque",
    description: "Buffet crème avec miroirs triptyque arrondis et vases décoratifs. Finitions dorées, style Art Déco contemporain.",
    category: MOCK_CATEGORIES[5],
    productType: "standard",
    priceMode: "fixed",
    price: 1890,
    images: ["buffetMiroir"],
    customizable: false,
    deliveryEstimates: { metropole: "2-3 semaines", outreMer: "8-12 semaines" },
    media: [],
    createdAt: "2026-03-12",
  },
];

// Helper to get an Image source from a product image value. Real products from
// the backend carry remote URLs (http/https) or local file URIs; legacy mock
// data uses local asset keys mapped in PRODUCT_IMAGES.
export const getProductImage = (key?: string | null) => {
  if (!key) return null;
  if (/^(https?:|file:|data:|content:)/.test(key)) {
    return { uri: key };
  }
  return (PRODUCT_IMAGES as any)[key] ?? null;
};

// Get featured products (for home screen hero)
export const getFeaturedProducts = () => MOCK_PRODUCTS.slice(0, 6);

// Get new arrivals
export const getNewArrivals = () =>
  [...MOCK_PRODUCTS]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

// Get products by category
export const getProductsByCategory = (categoryId: string) =>
  MOCK_PRODUCTS.filter((p) => p.category.id === categoryId);

// ─── Mock Conversations ────────────────────────────────────
import type { Conversation, Message } from "./types";

export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "conv1",
    subject: "Devis Cuisine Noire & Or",
    product: MOCK_PRODUCTS.find((p) => p.id === "c3"),
    lastMessage: "Bonjour, votre devis est prêt. Nous vous proposons une configuration personnalisée avec îlot central.",
    lastMessageAt: new Date(Date.now() - 12 * 60000).toISOString(),
    unreadCount: 2,
    vendorName: "Atelier Cuisines",
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: "conv2",
    subject: "Commande Porte Géométrique",
    product: MOCK_PRODUCTS.find((p) => p.id === "p1"),
    lastMessage: "La fabrication de votre porte est en cours. Livraison prévue semaine 18.",
    lastMessageAt: new Date(Date.now() - 3 * 3600000).toISOString(),
    unreadCount: 0,
    vendorName: "Atelier Portes",
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: "conv3",
    subject: "Question Canapé Bordeaux",
    product: MOCK_PRODUCTS.find((p) => p.id === "s1"),
    lastMessage: "Oui, ce modèle est disponible en tissu gris anthracite également. Souhaitez-vous un échantillon ?",
    lastMessageAt: new Date(Date.now() - 86400000).toISOString(),
    unreadCount: 1,
    vendorName: "Service Client",
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
];

export const MOCK_MESSAGES: Record<string, Message[]> = {
  conv1: [
    { id: "m1", conversationId: "conv1", content: "Bonjour, je souhaite un devis pour la Cuisine Noire & Or avec quelques modifications.", sender: "user", createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
    { id: "m2", conversationId: "conv1", content: "Bonjour ! Bien sûr, quelles modifications souhaitez-vous apporter ?", sender: "vendor", createdAt: new Date(Date.now() - 2 * 86400000 + 3600000).toISOString() },
    { id: "m3", conversationId: "conv1", content: "J'aimerais un îlot plus large (3m) et un plan de travail en marbre Calacatta.", sender: "user", createdAt: new Date(Date.now() - 86400000).toISOString() },
    { id: "m4", conversationId: "conv1", content: "Bonjour, votre devis est prêt. Nous vous proposons une configuration personnalisée avec îlot central.", sender: "vendor", createdAt: new Date(Date.now() - 12 * 60000).toISOString() },
  ],
  conv2: [
    { id: "m5", conversationId: "conv2", content: "Bonjour, est-ce que ma commande est bien en cours ?", sender: "user", createdAt: new Date(Date.now() - 5 * 86400000).toISOString() },
    { id: "m6", conversationId: "conv2", content: "Bonjour, oui votre porte est en fabrication dans nos ateliers. Tout se passe bien.", sender: "vendor", createdAt: new Date(Date.now() - 4 * 86400000).toISOString() },
    { id: "m7", conversationId: "conv2", content: "La fabrication de votre porte est en cours. Livraison prévue semaine 18.", sender: "vendor", createdAt: new Date(Date.now() - 3 * 3600000).toISOString() },
  ],
  conv3: [
    { id: "m8", conversationId: "conv3", content: "Bonjour, le canapé bordeaux est-il disponible dans d'autres coloris ?", sender: "user", createdAt: new Date(Date.now() - 7 * 86400000).toISOString() },
    { id: "m9", conversationId: "conv3", content: "Oui, ce modèle est disponible en tissu gris anthracite également. Souhaitez-vous un échantillon ?", sender: "vendor", createdAt: new Date(Date.now() - 86400000).toISOString() },
  ],
};
