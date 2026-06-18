/**
 * Seed data mirrored from the mobile app's lib/mock-data.ts (and constants.ts),
 * but with image *filenames* instead of require() asset handles so it can run in
 * Node. The seed script uploads each referenced file from
 * `<repo>/assets/la menagere/` to Supabase Storage and stores the public URLs.
 */

export interface SeedCategory {
  slug: string;
  name: string;
  icon: string;
  accentColor: string;
  description?: string;
}

export interface SeedProduct {
  slug: string;
  name: string;
  description: string;
  categorySlug: string;
  productType: 'standard' | 'configurable';
  priceMode: 'fixed' | 'per_sqm';
  price?: number; // euros
  pricePerSqm?: number; // euros per m² (per_sqm mode)
  minDimensions?: { width: number; height: number };
  maxDimensions?: { width: number; height: number };
  openingTypes?: { type: string; surcharge: number }[]; // surcharge in euros
  imageKeys: string[];
  customizable: boolean;
  dimensions?: { width: number; height: number; depth?: number; unit: string };
  deliveryEstimates: { metropole: string; outreMer: string };
  createdAt: string;
  featured?: boolean;
}

/** Image key -> filename under assets/la menagere/. */
export const PRODUCT_IMAGE_FILES: Record<string, string> = {
  porteGeometrique: 'IMG-20251116-WA0014.jpg',
  portePrestige: 'InShot_20260408_140933950.jpg',
  porteContemporaine: 'InShot_20260408_140909018.jpg',
  porteElegance: 'InShot_20260408_140958614.jpg',
  portePivotante: 'InShot_20260326_061656000.jpg',
  porteVague: 'IMG_20260203_024134.jpg',
  porteLED: 'IMG_20260203_024145.jpg',
  porteBicolore: 'IMG-20250304-WA0025.jpg',
  porteArtDeco: 'IMG-20251214-WA0016.jpg',
  porteFatima: 'IMG_20260406_085207.jpg',
  cuisineIlotChene: 'mmexport1773909383698.jpg',
  cuisineBlanche: 'InShot_20260404_074237712.jpg',
  cuisineLuxeIlot: 'IMG-20260318-WA0018.jpg',
  cuisineGriseL: 'mmexport1773909419843.jpg',
  cuisineGriseLaquee: 'InShot_20260319_093141170.jpg',
  cuisineOuverteGrise: 'InShot_20260319_093116884.jpg',
  cuisineMarbreNoir: 'FB_IMG_1773743531811.jpg',
  cuisineNoireOr: 'InShot_20260408_075343412.jpg',
  cuisineArrondie: 'IMG-20260205-WA0007.jpg',
  cuisineIlotGrise: 'InShot_20260408_075550209.jpg',
  canapeModulable: 'FB_IMG_1773743549810.jpg',
  canapeBordeaux: 'FB_IMG_1773743542000.jpg',
  salonBicolore: 'FB_IMG_1773743504654.jpg',
  salonBordeauxTV: 'FB_IMG_1773743547838.jpg',
  chambreRoyale: '1770946539936.png',
  commodeDoree: '1770946558773.png',
  chevetLuxe: '1770946553405.png',
  chambreDressing: 'mmexport1770260686245.jpg',
  dressingWalkIn: 'mmexport1770260677093.jpg',
  baieCoulissante: 'IMG-20260317-WA0028.jpg',
  fenetreVolet: 'IMG-20260317-WA0031.jpg',
  buffetMiroir: '1770946546676.png',
};

export const SEED_CATEGORIES: SeedCategory[] = [
  { slug: 'portes', name: 'Portes', icon: 'door', accentColor: '#F5E6DC', description: "Portes d'entrée, intérieures et vitrées" },
  { slug: 'cuisines', name: 'Cuisines', icon: 'countertop', accentColor: '#E8E0F0', description: 'Cuisines équipées et sur mesure' },
  { slug: 'canapes', name: 'Canapés', icon: 'sofa', accentColor: '#DCE8E0', description: 'Mobilier de salon' },
  { slug: 'chambres', name: 'Chambres', icon: 'bed', accentColor: '#F0E0E8', description: 'Lits, armoires, commodes' },
  { slug: 'baies-vitrees', name: 'Baies Vitrées', icon: 'window-open-variant', accentColor: '#E0E8F0', description: 'Fenêtres et baies coulissantes' },
  { slug: 'decoration', name: 'Décoration', icon: 'lamp', accentColor: '#F0EAD6', description: 'Objets et accessoires' },
];

export const SEED_PRODUCTS: SeedProduct[] = [
  {
    slug: 'fenetre-aluminium-sur-mesure',
    name: 'Fenêtre Aluminium Sur Mesure',
    description:
      "Fenêtre aluminium sur mesure à double vitrage. Indiquez vos dimensions : le prix se calcule automatiquement au m². Choisissez votre type d'ouverture.",
    categorySlug: 'baies-vitrees',
    productType: 'configurable',
    priceMode: 'per_sqm',
    pricePerSqm: 450, // 450 €/m²
    minDimensions: { width: 40, height: 40 },
    maxDimensions: { width: 300, height: 300 },
    openingTypes: [
      { type: 'fixe', surcharge: 0 },
      { type: 'battante', surcharge: 80 },
      { type: 'oscillo_battante', surcharge: 150 },
      { type: 'soufflet', surcharge: 120 },
      { type: 'coulissante', surcharge: 220 },
    ],
    imageKeys: ['baieCoulissante'],
    customizable: true,
    dimensions: { width: 120, height: 150, unit: 'cm' },
    deliveryEstimates: { metropole: '3-4 semaines', outreMer: '8-12 semaines' },
    createdAt: '2026-05-01',
    featured: true,
  },
  {
    slug: 'porte-entree-sur-mesure',
    name: "Porte d'Entrée Sur Mesure",
    description:
      "Porte d'entrée aluminium sur mesure. Prix calculé au m² selon vos dimensions, avec choix du type d'ouverture.",
    categorySlug: 'portes',
    productType: 'configurable',
    priceMode: 'per_sqm',
    pricePerSqm: 600, // 600 €/m²
    minDimensions: { width: 70, height: 180 },
    maxDimensions: { width: 200, height: 260 },
    openingTypes: [
      { type: 'battante', surcharge: 0 },
      { type: 'pivotante', surcharge: 300 },
      { type: 'coulissante', surcharge: 250 },
      { type: 'double_battant', surcharge: 400 },
    ],
    imageKeys: ['porteContemporaine'],
    customizable: true,
    dimensions: { width: 90, height: 215, unit: 'cm' },
    deliveryEstimates: { metropole: '4-5 semaines', outreMer: '10-14 semaines' },
    createdAt: '2026-05-01',
    featured: true,
  },
  {
    slug: 'porte-geometrique-noyer',
    name: 'Porte Géométrique Noyer',
    description:
      "Porte d'entrée blindée en bois de noyer avec motifs géométriques élégants. Double vantail, serrure multipoints haute sécurité.",
    categorySlug: 'portes',
    productType: 'standard',
    priceMode: 'fixed',
    price: 3850,
    imageKeys: ['porteGeometrique'],
    customizable: false,
    dimensions: { width: 170, height: 210, unit: 'cm' },
    deliveryEstimates: { metropole: '2-3 semaines', outreMer: '8-12 semaines' },
    createdAt: '2026-03-01',
    featured: true,
  },
  {
    slug: 'porte-pivotante-luxe',
    name: 'Porte Pivotante Luxe 3D',
    description:
      'Porte pivotante premium avec relief 3D sculptural. Système pivot invisible, finition bois naturel sur cadre aluminium noir.',
    categorySlug: 'portes',
    productType: 'configurable',
    priceMode: 'per_sqm',
    pricePerSqm: 720, // 720 €/m²
    minDimensions: { width: 80, height: 200 },
    maxDimensions: { width: 220, height: 280 },
    openingTypes: [
      { type: 'pivotante', surcharge: 0 },
      { type: 'battante', surcharge: -200 },
      { type: 'double_battant', surcharge: 350 },
    ],
    imageKeys: ['portePivotante'],
    customizable: true,
    dimensions: { width: 120, height: 260, unit: 'cm' },
    deliveryEstimates: { metropole: '3-4 semaines', outreMer: '10-14 semaines' },
    createdAt: '2026-02-15',
    featured: true,
  },
  {
    slug: 'porte-noire-led',
    name: 'Porte Noire LED',
    description:
      "Porte d'entrée noire avec bande LED intégrée. Design ultra-moderne, système pivot, ouverture à 180°.",
    categorySlug: 'portes',
    productType: 'configurable',
    priceMode: 'per_sqm',
    pricePerSqm: 680, // 680 €/m²
    minDimensions: { width: 80, height: 200 },
    maxDimensions: { width: 200, height: 270 },
    openingTypes: [
      { type: 'pivotante', surcharge: 0 },
      { type: 'battante', surcharge: -200 },
      { type: 'coulissante', surcharge: 250 },
    ],
    imageKeys: ['porteLED'],
    customizable: true,
    deliveryEstimates: { metropole: '3-4 semaines', outreMer: '10-14 semaines' },
    createdAt: '2026-01-20',
    featured: true,
  },
  {
    slug: 'porte-prestige-noyer',
    name: 'Porte Prestige Noyer',
    description:
      "Porte d'entrée en bois noyer massif avec motifs géométriques noirs. Installation sur façade pierre.",
    categorySlug: 'portes',
    productType: 'standard',
    priceMode: 'fixed',
    price: 4200,
    imageKeys: ['portePrestige'],
    customizable: false,
    dimensions: { width: 100, height: 220, unit: 'cm' },
    deliveryEstimates: { metropole: '2-3 semaines', outreMer: '8-12 semaines' },
    createdAt: '2026-03-10',
    featured: true,
  },
  {
    slug: 'cuisine-ilot-chene',
    name: 'Cuisine Îlot Chêne Clair',
    description:
      'Cuisine moderne en L avec îlot central en chêne clair. Plan de travail marbre, hotte intégrée, rangements optimisés.',
    categorySlug: 'cuisines',
    productType: 'standard',
    priceMode: 'fixed',
    price: 8900,
    imageKeys: ['cuisineIlotChene'],
    customizable: false,
    deliveryEstimates: { metropole: '4-6 semaines', outreMer: '12-16 semaines' },
    createdAt: '2026-03-05',
    featured: true,
  },
  {
    slug: 'cuisine-luxe-ilot-arrondi',
    name: 'Cuisine Luxe Îlot Arrondi',
    description:
      'Cuisine de prestige avec îlot arrondi, vitrine noire intégrée, sol marbre et lustre design. Finition laquée blanche.',
    categorySlug: 'cuisines',
    productType: 'standard',
    priceMode: 'fixed',
    price: 12500,
    imageKeys: ['cuisineLuxeIlot'],
    customizable: false,
    deliveryEstimates: { metropole: '6-8 semaines', outreMer: '14-18 semaines' },
    createdAt: '2026-03-18',
    featured: true,
  },
  {
    slug: 'cuisine-noire-or',
    name: 'Cuisine Noire & Or',
    description:
      'Cuisine haut de gamme noire avec accents dorés et bois. Îlot bar avec tabourets crème, four et frigo encastrés.',
    categorySlug: 'cuisines',
    productType: 'standard',
    priceMode: 'fixed',
    price: 10900,
    imageKeys: ['cuisineNoireOr'],
    customizable: false,
    deliveryEstimates: { metropole: '4-6 semaines', outreMer: '12-16 semaines' },
    createdAt: '2026-04-08',
  },
  {
    slug: 'cuisine-grise-laquee',
    name: 'Cuisine Grise Laquée',
    description:
      'Cuisine grise laquée avec armoires vitrées en bois, four encastré et sol marbre. Élégance et fonctionnalité.',
    categorySlug: 'cuisines',
    productType: 'standard',
    priceMode: 'fixed',
    price: 7900,
    imageKeys: ['cuisineGriseLaquee'],
    customizable: false,
    deliveryEstimates: { metropole: '4-6 semaines', outreMer: '12-16 semaines' },
    createdAt: '2026-03-19',
  },
  {
    slug: 'canape-modulable-bordeaux',
    name: 'Canapé Modulable Bordeaux',
    description:
      'Canapé modulable en L, tissu bordeaux premium. Table basse ronde assortie. Mur panneaux 3D décoratifs inclus.',
    categorySlug: 'canapes',
    productType: 'standard',
    priceMode: 'fixed',
    price: 2890,
    imageKeys: ['canapeModulable'],
    customizable: false,
    dimensions: { width: 320, height: 95, depth: 180, unit: 'cm' },
    deliveryEstimates: { metropole: '2-3 semaines', outreMer: '8-12 semaines' },
    createdAt: '2026-02-10',
  },
  {
    slug: 'salon-bicolore-creme',
    name: 'Salon Bicolore Crème',
    description:
      "Ensemble salon moderne avec canapé bicolore crème et brun, table basse design et chaise d'appoint assortie.",
    categorySlug: 'canapes',
    productType: 'standard',
    priceMode: 'fixed',
    price: 3450,
    imageKeys: ['salonBicolore'],
    customizable: false,
    dimensions: { width: 280, height: 85, depth: 160, unit: 'cm' },
    deliveryEstimates: { metropole: '2-3 semaines', outreMer: '8-12 semaines' },
    createdAt: '2026-01-15',
  },
  {
    slug: 'chambre-royale-blanche-or',
    name: 'Chambre Royale Blanche & Or',
    description:
      'Chambre complète luxe : lit king-size, chevets miroir, commode et suspensions. Finitions blanches et dorées.',
    categorySlug: 'chambres',
    productType: 'standard',
    priceMode: 'fixed',
    price: 5890,
    imageKeys: ['chambreRoyale'],
    customizable: false,
    deliveryEstimates: { metropole: '3-4 semaines', outreMer: '10-14 semaines' },
    createdAt: '2026-02-20',
  },
  {
    slug: 'dressing-walk-in',
    name: 'Dressing Walk-In Bois',
    description:
      'Dressing walk-in luxe en bois foncé avec îlot central, rangements ouverts et éclairage plafond intégré.',
    categorySlug: 'chambres',
    productType: 'standard',
    priceMode: 'fixed',
    price: 4500,
    imageKeys: ['dressingWalkIn'],
    customizable: false,
    deliveryEstimates: { metropole: '4-6 semaines', outreMer: '12-16 semaines' },
    createdAt: '2026-01-10',
  },
  {
    slug: 'buffet-miroir-triptyque',
    name: 'Buffet Miroir Triptyque',
    description:
      'Buffet crème avec miroirs triptyque arrondis et vases décoratifs. Finitions dorées, style Art Déco contemporain.',
    categorySlug: 'decoration',
    productType: 'standard',
    priceMode: 'fixed',
    price: 1890,
    imageKeys: ['buffetMiroir'],
    customizable: false,
    deliveryEstimates: { metropole: '2-3 semaines', outreMer: '8-12 semaines' },
    createdAt: '2026-03-12',
  },
];
