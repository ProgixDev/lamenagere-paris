import { COLORS } from "./constants";

/**
 * Premium type system for the signed-in app.
 *
 * Two voices, used with restraint:
 *  - SERIF (Cormorant) — an elegant, high-contrast display serif reserved for
 *    hero titles, section headings, screen titles and prices. This is what
 *    gives the catalog its "boutique" feel.
 *  - BODY (Futura, mapped from the legacy Inter / Manrope family names in
 *    app/_layout.tsx) — calm, neutral UI text for everything else.
 *
 * Hierarchy comes from serif-vs-body, size, weight and whitespace — never from
 * decorative colour. The palette stays monochrome (navy + warm neutrals).
 */
export const FONTS = {
  // Display serif (Cormorant)
  serif: "Cormorant_600SemiBold",
  serifBold: "Cormorant_700Bold",
  serifMedium: "Cormorant_500Medium",

  // Body / UI (Futura under the hood)
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemibold: "Inter_600SemiBold",
  bodyBold: "Manrope_700Bold",
} as const;

/**
 * Ready-made text presets. Spread into a style array, e.g.
 *   <Text style={[TYPE.sectionTitle, { marginBottom: 4 }]}>…</Text>
 */
export const TYPE = {
  // Cormorant runs visually small, so display sizes are bumped a little.
  hero: {
    fontFamily: FONTS.serifBold,
    fontSize: 30,
    lineHeight: 34,
    color: COLORS.onSurface,
  },
  screenTitle: {
    fontFamily: FONTS.serif,
    fontSize: 26,
    lineHeight: 30,
    color: COLORS.onSurface,
  },
  sectionTitle: {
    fontFamily: FONTS.serif,
    fontSize: 22,
    lineHeight: 26,
    color: COLORS.onSurface,
  },
  // Letter-spaced, uppercase micro-label that pairs with the serif headings.
  overline: {
    fontFamily: FONTS.bodySemibold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase" as const,
    color: COLORS.outline,
  },
  price: {
    fontFamily: FONTS.serif,
    fontSize: 20,
    color: COLORS.onSurface,
  },
  priceLarge: {
    fontFamily: FONTS.serifBold,
    fontSize: 28,
    color: COLORS.onSurface,
  },
  bodyText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.onSurfaceVariant,
  },
} as const;

/** Spacing scale (8pt rhythm) used for the premium, more generous layout. */
export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Soft, low elevation for borderless cards — replaces muddy hairline borders. */
export const SHADOW = {
  card: {
    shadowColor: "#1A1C1C",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  soft: {
    shadowColor: "#1A1C1C",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
} as const;
