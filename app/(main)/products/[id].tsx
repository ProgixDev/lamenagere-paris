import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  Share,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Icon from "../../../components/ui/Icon";
import Animated, {
  FadeInUp,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { COLORS, BRAND, PRODUCT_TYPES, PRICE_MODES } from "../../../lib/constants";
import { FONTS, TYPE, SHADOW } from "../../../lib/typography";
import { formatPrice } from "../../../lib/utils";
import { priceTagLabel, computeConfiguredPrice, perSqmRate } from "../../../lib/pricing";
import {
  areaFormula,
  formatAreaDimensions,
  type AreaDimensions,
} from "../../../lib/area-formulas";
import { isOutOfStock, maxOrderableQty } from "../../../lib/stock";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import PressableScale from "../../../components/ui/PressableScale";
import Toast from "../../../components/ui/Toast";
import ContactSellerSheet from "../../../components/product/ContactSellerSheet";
import DevisRequestSheet from "../../../components/product/DevisRequestSheet";
import ProductVideo from "../../../components/product/ProductVideo";
import { getProductImage } from "../../../lib/mock-data";
import { useCartStore } from "../../../features/cart/store";
import { useFavoritesStore } from "../../../features/favorites/store";
import { useProduct, usePopularProducts } from "../../../features/products/hooks";
import { useProductReviews } from "../../../features/reviews/hooks";
import { useRequireAuth } from "../../../features/auth/guards";
import StarRating from "../../../components/ui/StarRating";
import QuantitySelector from "../../../components/ui/QuantitySelector";
import { productCoverSource } from "../../../lib/product-media";

const { width: W, height: H } = Dimensions.get("window");
const GALLERY_H = Math.min(W, H * 0.55);

/** Brand-blue gradient for the page's filled CTA. */
const CTA_TINT = [BRAND.blue, BRAND.blueDeep] as const;

/** The logo's blue · yellow · red bar, used once to open the title block. */
function BrandRule() {
  return (
    <View
      style={{ flexDirection: "row", width: 88, height: 3, borderRadius: 2, overflow: "hidden" }}
    >
      <View style={{ flex: 1, backgroundColor: BRAND.blue }} />
      <View style={{ flex: 1, backgroundColor: BRAND.yellow }} />
      <View style={{ flex: 1, backgroundColor: BRAND.red }} />
    </View>
  );
}


// ────────────────────────────────────────────────────────
export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: product, isLoading } = useProduct(id);
  const { data: popular = [] } = usePopularProducts(12);
  const { data: reviews = [] } = useProductReviews(id);

  const addItem = useCartStore((s) => s.addItem);
  const isFavorited = useFavoritesStore((s) => s.favorites.includes(id));
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  // Browsing and building a cart stay open to guests; asking for a quote or
  // messaging the seller writes to their account, so those need a sign-in.
  const requireAuth = useRequireAuth();

  const [galleryIndex, setGalleryIndex] = useState(0);
  const [selectedColorKey, setSelectedColorKey] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [devisOpen, setDevisOpen] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  // Units chosen on the stepper, for products sold by the unit. `addedCount`
  // keeps the last added amount so the confirmation can name it after the
  // stepper has gone back to one.
  const [quantity, setQuantity] = useState(1);
  const [addedCount, setAddedCount] = useState(1);
  // Inline made-to-measure inputs (cm) for per-m² products. Which fields are
  // shown is decided by the product's area formula, so this is keyed by
  // dimension rather than fixed to width/height.
  const [dimInputs, setDimInputs] = useState<Record<string, string>>({});
  const [qualityTier, setQualityTier] = useState<string | null>(null);
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "success" as "success" | "error",
  });
  const galleryRef = useRef<ScrollView>(null);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 16, color: COLORS.onSurfaceVariant, fontFamily: "Inter_500Medium" }}>
          Produit introuvable
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 14, color: COLORS.primary, fontFamily: "Inter_600SemiBold" }}>
            Retour
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isPerSqm = product.priceMode === PRICE_MODES.PER_SQM;
  const qualityTiers = product.qualityTiers ?? [];
  const hasTiers = qualityTiers.length > 0;
  // Made-to-measure: needs width/height before it can be priced/ordered.
  const needsDimensions =
    product.productType === PRODUCT_TYPES.CONFIGURABLE || isPerSqm;
  const openingTypes = product.openingTypes ?? [];
  const hasOpeningTypes = openingTypes.length > 0;
  // Effective blocks: product override wins, else the category template.
  const configBlocks = product.configBlocks ?? product.category.configBlocks ?? [];
  // Colour variants: picking one swaps the gallery to that colour's images.
  const colors = (product.colors ?? []).filter((c) => c.images.length > 0);
  const hasColors = colors.length > 0;
  const selectedColor = hasColors
    ? colors.find((c) => c.key === selectedColorKey) ?? colors[0]
    : null;
  // The selected colour's images win; otherwise the product's own gallery.
  const activeImages =
    selectedColor && selectedColor.images.length ? selectedColor.images : product.images;
  // Gallery shows images first, then videos. Falls back to a placeholder cell.
  const galleryItems: { type: "image" | "video"; key: string }[] = [
    ...activeImages.map((url) => ({ type: "image" as const, key: url })),
    ...(product.videos ?? []).map((url) => ({ type: "video" as const, key: url })),
  ];
  if (galleryItems.length === 0) {
    galleryItems.push({ type: "image", key: "__placeholder__" });
  }

  // Products that need any choice (dimensions, opening, or config blocks) are
  // configured in the dedicated guided flow rather than inline on this page.
  const hasConfiguration =
    needsDimensions || hasOpeningTypes || configBlocks.length > 0;

  // Sold by the unit: nothing to configure, so the customer picks a quantity
  // with − / + and adds it straight to the cart. Two limits bound the stepper
  // and the lower one wins — what's left in stock, and the per-order cap set
  // in the back office. Neither is required; untracked products stop at 99.
  // A price is part of the deal: without one there's nothing to multiply, so
  // the product keeps the devis + add-to-cart bar.
  const isUnitSale = !hasConfiguration && !isPerSqm && product.price != null;
  const outOfStock = isOutOfStock(product);
  const maxQuantity = maxOrderableQty(product);
  // "Plus que 2" is only worth saying while it's true — above the low-stock
  // threshold the server reports en_stock and we stay quiet.
  const lowStock = product.stock === "stock_faible" && product.stockQty != null;

  // Pure made-to-measure (priced by area, no extra options): the customer
  // enters width × height right here and we price + add it to the cart inline.
  const optionBlocks = configBlocks.filter((b) => b.type !== "measurements");
  const inlineSqm = isPerSqm && !hasOpeningTypes && optionBlocks.length === 0;
  // The formula decides which dimensions to collect and how they make a surface.
  const formula = areaFormula(product.areaFormula);
  const dims: AreaDimensions = {};
  for (const field of formula.fields) {
    const value = parseFloat(dimInputs[field.key] ?? "");
    if (Number.isFinite(value)) dims[field.key] = value;
  }
  const validDims = formula.fields.every((f) => (dims[f.key] ?? 0) > 0);
  // Effective €/m² rate for the entered/selected tier (flat rate if no tiers).
  const effectiveRate = isPerSqm
    ? perSqmRate(product, qualityTier ?? undefined)
    : undefined;
  const tierReady = !hasTiers || !!qualityTier;
  const livePrice =
    inlineSqm && validDims && tierReady
      ? computeConfiguredPrice(product, dims, undefined, qualityTier ?? undefined)
      : undefined;
  // Estimate shown by the standalone calculator below "À propos". Covers every
  // per-m² product (even configurable ones); it's informational only — the
  // guided configure flow stays authoritative for products with extra options.
  const estimatePrice =
    isPerSqm && validDims && tierReady
      ? computeConfiguredPrice(product, dims, undefined, qualityTier ?? undefined)
      : undefined;

  const handlePrimaryAction = async () => {
    // Pure per-m² product → price & add inline using the entered dimensions.
    if (inlineSqm) {
      if (hasTiers && !qualityTier) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setToast({ visible: true, message: "Choisissez une gamme", type: "error" });
        return;
      }
      if (!validDims || livePrice == null) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setToast({
          visible: true,
          message: `Renseignez ${formula.fields.map((f) => f.label.toLowerCase()).join(", ")}`,
          type: "error",
        });
        return;
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      addItem(product, 1, dims, undefined, qualityTier ?? undefined);
      setAddedCount(1);
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1500);
      setToast({ visible: true, message: "Ajouté au panier", type: "success" });
      return;
    }
    if (hasConfiguration) {
      await Haptics.selectionAsync();
      router.push(`/(main)/configure/${product.id}`);
      return;
    }
    // Sold by the unit → the chosen quantity goes straight to the cart.
    if (outOfStock) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setToast({ visible: true, message: "Ce produit est en rupture de stock", type: "error" });
      return;
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addItem(product, quantity);
    setAddedCount(quantity);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
    setToast({
      visible: true,
      message: quantity > 1 ? `${quantity} articles ajoutés au panier` : "Ajouté au panier",
      type: "success",
    });
    // Back to one, so a second tap doesn't silently repeat a large order.
    setQuantity(1);
  };

  const handleFavorite = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleFavorite(product.id);
  };

  const onGalleryScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / W);
    if (i !== galleryIndex) setGalleryIndex(i);
  };

  const selectColor = async (key: string) => {
    if (key === (selectedColor?.key ?? null)) return;
    await Haptics.selectionAsync();
    setSelectedColorKey(key);
    // Jump the gallery back to the first image of the new colour.
    setGalleryIndex(0);
    galleryRef.current?.scrollTo({ x: 0, animated: false });
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 174 + Math.max(insets.bottom, 12) }}
      >
        {/* ── Gallery ──────────────────────────────── */}
        <View style={{ width: W, height: GALLERY_H, backgroundColor: COLORS.surfaceContainer }}>
          <ScrollView
            ref={galleryRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onGalleryScroll}
            scrollEventThrottle={16}
          >
            {galleryItems.map((item, idx) => {
              if (item.type === "video") {
                return (
                  <ProductVideo key={`${item.key}-${idx}`} uri={item.key} width={W} height={GALLERY_H} />
                );
              }
              const src = getProductImage(item.key);
              return (
                <View key={`${item.key}-${idx}`} style={{ width: W, height: GALLERY_H, alignItems: "center", justifyContent: "center" }}>
                  {src ? (
                    <Image source={src} style={{ width: W, height: GALLERY_H }} resizeMode="cover" />
                  ) : (
                    <Icon name="image-off-outline" size={48} color={COLORS.outline} />
                  )}
                </View>
              );
            })}
          </ScrollView>

          {/* Top overlay controls */}
          <SafeAreaView edges={["top"]} style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingTop: 6 }}>
              <CircleButton icon="chevron-left" onPress={() => router.back()} />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <CircleButton
                  icon={isFavorited ? "heart" : "heart-outline"}
                  color={isFavorited ? "#E74040" : COLORS.onSurface}
                  onPress={handleFavorite}
                />
                <CircleButton icon="magnify" onPress={() => router.push("/(main)/search")} />
                <CircleButton
                  icon="share-variant"
                  onPress={() =>
                    product &&
                    Share.share({ message: `${product.name} — La Ménagère Paris` })
                  }
                />
              </View>
            </View>
          </SafeAreaView>

          {/* Page counter */}
          {galleryItems.length > 1 && (
            <View
              style={{
                position: "absolute",
                bottom: 14,
                right: 14,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 9999,
                backgroundColor: "rgba(0,0,0,0.55)",
              }}
            >
              <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#fff" }}>
                {galleryIndex + 1} / {galleryItems.length}
              </Text>
            </View>
          )}
        </View>

        {/* ── Trust strip ──────────────────────────── */}
        <View
          style={{
            flexDirection: "row",
            paddingVertical: 12,
            paddingHorizontal: 16,
            backgroundColor: COLORS.surfaceContainerLow,
            gap: 14,
          }}
        >
          <TrustItem icon="truck-outline" label="Livraison DOM-TOM gratuite" />
          <View style={{ width: 1, backgroundColor: COLORS.outlineVariant }} />
          <TrustItem icon="shield-check-outline" label="Garantie 2 ans" />
          <View style={{ width: 1, backgroundColor: COLORS.outlineVariant }} />
          <TrustItem icon="message-text-outline" label="Conseils dédiés" />
        </View>

        {/* ── Title + price block ──────────────────── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          <BrandRule />
          <Text style={[TYPE.overline, { marginTop: 12, marginBottom: 6, color: BRAND.blue }]}>
            {product.category.name}
          </Text>
          <Text
            style={{
              fontSize: 32,
              fontFamily: FONTS.serifBold,
              color: COLORS.onSurface,
              lineHeight: 36,
            }}
          >
            {product.name}
          </Text>
          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.outline, marginTop: 4 }}>
            par La Ménagère Paris
          </Text>

          {product.ratingCount ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10 }}>
              <Icon name="star" size={15} color={BRAND.yellow} />
              <Text style={{ fontSize: 14, fontFamily: "Manrope_700Bold", color: COLORS.onSurface }}>
                {(product.ratingAvg ?? 0).toFixed(1)}
              </Text>
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.outline }}>
                · {product.ratingCount} avis
              </Text>
            </View>
          ) : null}

          {/* Price — live total for made-to-measure once dimensions are set. */}
          <View style={{ marginTop: 16, marginBottom: 4 }}>
            {isPerSqm ? (
              <View>
                <Text style={[TYPE.priceLarge, { fontSize: 32, color: BRAND.blue }]}>
                  {livePrice != null ? formatPrice(livePrice) : priceTagLabel(product)}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.outline, marginTop: 4 }}>
                  {livePrice != null && validDims && effectiveRate != null
                    ? `Soit ${formatPrice(effectiveRate)}/m² · ${formatAreaDimensions(formula.key, dims)}`
                    : hasTiers && !qualityTier
                      ? "Choisissez une gamme et vos dimensions ci-dessous"
                      : "Indiquez vos dimensions ci-dessous pour obtenir le prix"}
                </Text>
              </View>
            ) : product.price ? (
              <Text style={[TYPE.priceLarge, { fontSize: 32, color: BRAND.blue }]}>
                {formatPrice(product.price)}
              </Text>
            ) : null}

            {/* Availability, said only when it changes what the customer can
                do: nothing left, or few enough that waiting is a risk. */}
            {isUnitSale && (outOfStock || lowStock) && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 10,
                }}
              >
                <Icon
                  name={outOfStock ? "close-circle-outline" : "alert-circle-outline"}
                  size={15}
                  color={outOfStock ? COLORS.error : COLORS.warning}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: FONTS.bodyMedium,
                    color: outOfStock ? COLORS.error : COLORS.warning,
                  }}
                >
                  {outOfStock
                    ? "Rupture de stock"
                    : `Plus que ${product.stockQty} en stock`}
                </Text>
              </View>
            )}
          </View>

          {/* ── DOM-TOM Delivery Info ───────────────── */}
          <View
            style={{
              marginTop: 16,
              backgroundColor: "rgba(231, 240, 255, 0.4)",
              borderRadius: 12,
              padding: 12,
              flexDirection: "row",
              gap: 12,
              borderWidth: 1,
              borderColor: `${BRAND.blue}30`,
              alignItems: "center"
            }}
          >
            <View style={{ backgroundColor: "#fff", padding: 8, borderRadius: 10, ...SHADOW.soft }}>
              <Icon name="airplane" size={20} color={BRAND.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: BRAND.blueDeep, marginBottom: 2 }}>
                Livraison gratuite DOM-TOM
              </Text>
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.onSurfaceVariant, lineHeight: 16 }}>
                Mayotte, Île de La Réunion, Martinique, Guyane.{"\n"}
                <Text style={{ fontSize: 11, color: COLORS.outline }}>*Frais de douane non inclus</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* ── Colour picker ────────────────────────── */}
        {hasColors && (
          <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <Text style={{ fontSize: 12, fontFamily: FONTS.bodySemibold, color: COLORS.onSurfaceVariant, letterSpacing: 0.5 }}>
                COULEUR
              </Text>
              {selectedColor && (
                <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: COLORS.onSurface }}>
                  · {selectedColor.name}
                </Text>
              )}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {colors.map((color) => {
                const active = selectedColor?.key === color.key;
                const swatch = getProductImage(color.images[0]);
                return (
                  <TouchableOpacity
                    key={color.key}
                    onPress={() => selectColor(color.key)}
                    activeOpacity={0.85}
                    style={{ alignItems: "center", width: 58 }}
                  >
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 26,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: active ? 2 : 1,
                        borderColor: active ? BRAND.blue : COLORS.outlineVariant,
                        padding: 3,
                      }}
                    >
                      <View
                        style={{
                          width: "100%",
                          height: "100%",
                          borderRadius: 22,
                          overflow: "hidden",
                          backgroundColor: color.hex ?? COLORS.surfaceContainer,
                        }}
                      >
                        {swatch && (
                          <Image source={swatch} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                        )}
                      </View>
                    </View>
                    <Text
                      numberOfLines={1}
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
                        color: active ? COLORS.onSurface : COLORS.outline,
                        maxWidth: 58,
                        textAlign: "center",
                      }}
                    >
                      {color.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── À propos ─────────────────────────────── */}
        <Section title="À propos">
          <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: COLORS.onSurface, lineHeight: 20 }}>
            {product.description}
          </Text>
        </Section>

        {/* ── Made-to-measure calculator (per-m² products) ─── */}
        {/* Shape-driven products are priced from their configuration blocks, so
            the inline calculator can't stand alone — the guided flow owns it. */}
        {isPerSqm && formula.key !== "by_shape" && (
          <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
            <Text style={{ fontSize: 20, fontFamily: FONTS.serif, color: COLORS.onSurface, marginBottom: 4 }}>
              Calculez votre prix
            </Text>
            <Text style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.outline, marginBottom: 12 }}>
              Entrez vos mesures — le prix se calcule automatiquement.
              {formula.key !== "width_height" ? ` Surface facturée : ${formula.expression.toLowerCase()}.` : ""}
            </Text>
            <View style={{ backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 16, ...SHADOW.card }}>
              {hasTiers && (
                <View style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 12, fontFamily: FONTS.bodySemibold, color: COLORS.onSurfaceVariant, marginBottom: 8 }}>
                    GAMME
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {qualityTiers.map((tier) => {
                      const active = qualityTier === tier.key;
                      return (
                        <TouchableOpacity
                          key={tier.key}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setQualityTier(tier.key);
                          }}
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 9,
                            borderRadius: 9999,
                            backgroundColor: active ? BRAND.blue : "transparent",
                            borderWidth: 1,
                            borderColor: active ? BRAND.blue : COLORS.outlineVariant,
                          }}
                        >
                          <Text style={{ fontSize: 13, fontFamily: active ? "Inter_600SemiBold" : "Inter_500Medium", color: active ? COLORS.onPrimary : COLORS.onSurface }}>
                            {tier.label} · {formatPrice(tier.pricePerSqm)}/m²
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
              {/* One input per dimension the formula bills, two per row. */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                {formula.fields.map((field) => (
                  <View key={field.key} style={{ flexGrow: 1, flexBasis: "45%" }}>
                    <Input
                      label={field.label.toUpperCase()}
                      value={dimInputs[field.key] ?? ""}
                      onChangeText={(t) => setDimInputs((d) => ({ ...d, [field.key]: t }))}
                      keyboardType="numeric"
                      suffix="cm"
                    />
                  </View>
                ))}
              </View>
              {product.minDimensions && product.maxDimensions && (
                <Text style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.outline, marginTop: 4 }}>
                  De {product.minDimensions.width} à {product.maxDimensions.width} cm
                  {formula.fields.some((f) => f.axis === "horizontal") ? " (largeurs)" : ""}
                  {formula.fields.some((f) => f.axis === "vertical")
                    ? ` · de ${product.minDimensions.height} à ${product.maxDimensions.height} cm (hauteur)`
                    : ""}
                </Text>
              )}
              {validDims && (
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 12,
                  }}
                >
                  <Text style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.outline }}>
                    Surface
                  </Text>
                  <Text style={{ fontSize: 13, fontFamily: FONTS.bodySemibold, color: COLORS.onSurfaceVariant }}>
                    {formula.areaM2(dims).toFixed(2)} m²
                    {effectiveRate != null ? ` · ${formatPrice(effectiveRate)}/m²` : ""}
                  </Text>
                </View>
              )}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 14,
                  paddingTop: 14,
                  borderTopWidth: 1,
                  borderTopColor: COLORS.outlineVariant,
                }}
              >
                <Text style={{ fontSize: 14, fontFamily: FONTS.bodySemibold, color: COLORS.onSurfaceVariant }}>
                  {validDims ? "Prix estimé" : "Prix"}
                </Text>
                <Text style={[TYPE.price, { fontSize: 24, color: BRAND.blue }]}>
                  {estimatePrice != null ? formatPrice(estimatePrice) : "—"}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Customer reviews ─────────────────────── */}
        {reviews.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Section title="Avis clients" noBackground>
              <View style={{ gap: 14 }}>
                {reviews.map((r) => (
                  <View key={r.id}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 13, fontFamily: "Manrope_700Bold", color: COLORS.onSurface }}>
                        {r.authorName || "Client"}
                      </Text>
                      <StarRating rating={r.rating} size={14} />
                    </View>
                    {r.comment ? (
                      <Text
                        style={{
                          fontSize: 13,
                          fontFamily: "Inter_400Regular",
                          color: COLORS.onSurfaceVariant,
                          marginTop: 4,
                          lineHeight: 19,
                        }}
                      >
                        {r.comment}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            </Section>
          </View>
        )}

        {/* ── Related products ─────────────────────── */}
        <View style={{ marginTop: 16 }}>
          <Section title="Articles similaires" noBackground>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 16, paddingTop: 2, paddingBottom: 10 }}>
              {popular
                .filter((p) => p.id !== product.id)
                .slice(0, 6)
                .map((p) => {
                  const img = productCoverSource(p);
                  return (
                    <PressableScale
                      key={p.id}
                      onPress={() => router.push(`/(main)/products/${p.id}`)}
                      style={{
                        width: 130,
                        backgroundColor: COLORS.surfaceContainerLowest,
                        borderRadius: 10,
                        overflow: "hidden",
                        ...SHADOW.soft,
                      }}
                    >
                      <View style={{ width: "100%", height: 150, backgroundColor: COLORS.surfaceContainer }}>
                        {img && <Image source={img} style={{ width: "100%", height: "100%" }} resizeMode="cover" />}
                      </View>
                      <View style={{ paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10 }}>
                        <Text style={{ fontSize: 12, lineHeight: 16, height: 32, fontFamily: "Inter_500Medium", color: COLORS.onSurface }} numberOfLines={2}>
                          {p.name}
                        </Text>

                        {/* Price — navy text, no filled bar. */}
                        <Text
                          style={[TYPE.price, { fontSize: 15, color: COLORS.primary, textAlign: "right", marginTop: 5 }]}
                          numberOfLines={1}
                        >
                          {priceTagLabel(p)}
                        </Text>
                      </View>
                    </PressableScale>
                  );
                })}
            </ScrollView>
          </Section>
        </View>
      </ScrollView>

      {/* ── Sticky bottom action bar ───────────────── */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "#fff",
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 12) + 12,
          borderTopWidth: 1,
          borderTopColor: `${COLORS.outlineVariant}80`,
        }}
      >
        {/* Floating "+1 panier" confirmation that rises on a successful add. */}
        {justAdded && (
          <Animated.View
            entering={FadeInUp.springify().damping(16)}
            exiting={FadeOut.duration(200)}
            style={{
              position: "absolute",
              top: -34,
              alignSelf: "center",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 9999,
              backgroundColor: COLORS.success,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.18,
              shadowRadius: 6,
              elevation: 5,
            }}
          >
            <Icon name="cart-check" size={15} color="#fff" />
            <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" }}>
              +{addedCount} dans le panier
            </Text>
          </Animated.View>
        )}

        {/* A fixed-price product sold by the unit has a price already — only
            made-to-measure work needs quoting. */}
        {!isUnitSale && (
        <TouchableOpacity
          onPress={() =>
            requireAuth(() => setDevisOpen(true), {
              message:
                "Connectez-vous ou créez un compte pour demander un devis — nous vous répondrons dans votre espace.",
            })
          }
          activeOpacity={0.85}
          style={{
            backgroundColor: COLORS.surfaceContainerLowest,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: BRAND.blue,
            paddingVertical: 14,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <Icon name="file-document-outline" size={18} color={BRAND.blue} />
          <Text style={{ fontSize: 15, fontFamily: "Manrope_700Bold", color: BRAND.blue }}>
            Demander un devis
          </Text>
        </TouchableOpacity>
        )}

        {/* Sold by the unit: quantity on the left, add to cart filling the
            rest. Everything else keeps the single full-width CTA. */}
        {isUnitSale ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <QuantitySelector
              quantity={quantity}
              onQuantityChange={setQuantity}
              max={maxQuantity}
              outlined
              disabled={outOfStock}
            />
            <View style={{ flex: 1 }}>
              <Button
                label={
                  outOfStock
                    ? "Rupture de stock"
                    : justAdded
                      ? "Ajouté ✓"
                      : "Ajouter au panier"
                }
                onPress={handlePrimaryAction}
                disabled={outOfStock}
                size="lg"
                radius={14}
                tint={CTA_TINT}
              />
            </View>
          </View>
        ) : (
          <Button
            label={
              justAdded
                ? "Ajouté ✓"
                : hasConfiguration && !inlineSqm
                  ? "Configurer & commander"
                  : "Ajouter au panier"
            }
            onPress={handlePrimaryAction}
            size="lg"
            radius={14}
            tint={CTA_TINT}
          />
        )}
      </View>

      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onDismiss={() => setToast((p) => ({ ...p, visible: false }))}
      />

      {product && (
        <ContactSellerSheet
          product={product}
          visible={contactOpen}
          onClose={() => setContactOpen(false)}
        />
      )}

      <DevisRequestSheet
        productId={product.id}
        productName={product.name}
        visible={devisOpen}
        onClose={() => setDevisOpen(false)}
        onSubmitted={() =>
          setToast({ visible: true, message: "Demande de devis envoyée ✓", type: "success" })
        }
      />

      <FloatingContactButton
        onPress={() =>
          requireAuth(() => setContactOpen(true), {
            message:
              "Connectez-vous ou créez un compte pour contacter notre équipe au sujet de ce produit.",
          })
        }
      />
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────
function CircleButton({
  icon,
  onPress,
  color = COLORS.onSurface,
}: {
  icon: any;
  onPress: () => void;
  color?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: "rgba(255,255,255,0.95)",
        alignItems: "center",
        justifyContent: "center",
        ...SHADOW.soft,
      }}
    >
      <Icon name={icon} size={20} color={color} />
    </TouchableOpacity>
  );
}

/** Messenger-style floating contact bubble with a gentle pulse. */
function FloatingContactButton({ onPress }: { onPress: () => void }) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1.1, { duration: 1200 }), -1, true);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  return (
    <Animated.View
      entering={FadeInUp.springify().damping(14)}
      style={[
        {
          position: "absolute",
          right: 18,
          bottom: 168,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.22,
          shadowRadius: 8,
          elevation: 8,
        },
        style,
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: BRAND.blue,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="message-text" size={26} color={COLORS.onPrimary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

function TrustItem({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Icon name={icon} size={16} color={COLORS.success} />
      <Text style={{ flex: 1, fontSize: 11, fontFamily: "Inter_600SemiBold", color: COLORS.onSurface }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function Section({
  title,
  children,
  noBackground,
}: {
  title: string;
  children: React.ReactNode;
  noBackground?: boolean;
}) {
  return (
    <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
      <Text
        style={{
          fontSize: 20,
          fontFamily: FONTS.serif,
          color: COLORS.onSurface,
          marginBottom: 12,
        }}
      >
        {title}
      </Text>
      <View
        style={
          noBackground
            ? undefined
            : {
                backgroundColor: COLORS.surfaceContainerLowest,
                borderRadius: 16,
                padding: 16,
                ...SHADOW.soft,
              }
        }
      >
        {children}
      </View>
    </View>
  );
}


