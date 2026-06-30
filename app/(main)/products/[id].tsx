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
import { SafeAreaView } from "react-native-safe-area-context";
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
import { COLORS, PRODUCT_TYPES, PRICE_MODES } from "../../../lib/constants";
import { FONTS, TYPE, SHADOW } from "../../../lib/typography";
import { formatPrice } from "../../../lib/utils";
import { priceTagLabel, computeConfiguredPrice } from "../../../lib/pricing";
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
import StarRating from "../../../components/ui/StarRating";

const { width: W, height: H } = Dimensions.get("window");
const GALLERY_H = Math.min(W, H * 0.55);


// ────────────────────────────────────────────────────────
export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: product, isLoading } = useProduct(id);
  const { data: popular = [] } = usePopularProducts(12);
  const { data: reviews = [] } = useProductReviews(id);

  const addItem = useCartStore((s) => s.addItem);
  const isFavorited = useFavoritesStore((s) => s.favorites.includes(id));
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);

  const [galleryIndex, setGalleryIndex] = useState(0);
  const [contactOpen, setContactOpen] = useState(false);
  const [devisOpen, setDevisOpen] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  // Inline made-to-measure inputs (cm) for per-m² products.
  const [customWidth, setCustomWidth] = useState("");
  const [customHeight, setCustomHeight] = useState("");
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
  // Made-to-measure: needs width/height before it can be priced/ordered.
  const needsDimensions =
    product.productType === PRODUCT_TYPES.CONFIGURABLE || isPerSqm;
  const openingTypes = product.openingTypes ?? [];
  const hasOpeningTypes = openingTypes.length > 0;
  // Effective blocks: product override wins, else the category template.
  const configBlocks = product.configBlocks ?? product.category.configBlocks ?? [];
  // Gallery shows images first, then videos. Falls back to a placeholder cell.
  const galleryItems: { type: "image" | "video"; key: string }[] = [
    ...product.images.map((url) => ({ type: "image" as const, key: url })),
    ...(product.videos ?? []).map((url) => ({ type: "video" as const, key: url })),
  ];
  if (galleryItems.length === 0) {
    galleryItems.push({ type: "image", key: "__placeholder__" });
  }

  // Products that need any choice (dimensions, opening, or config blocks) are
  // configured in the dedicated guided flow rather than inline on this page.
  const hasConfiguration =
    needsDimensions || hasOpeningTypes || configBlocks.length > 0;

  // Pure made-to-measure (priced by area, no extra options): the customer
  // enters width × height right here and we price + add it to the cart inline.
  const optionBlocks = configBlocks.filter((b) => b.type !== "measurements");
  const inlineSqm = isPerSqm && !hasOpeningTypes && optionBlocks.length === 0;
  const dims =
    customWidth && customHeight
      ? { width: parseFloat(customWidth), height: parseFloat(customHeight) }
      : undefined;
  const validDims =
    !!dims &&
    Number.isFinite(dims.width) &&
    Number.isFinite(dims.height) &&
    dims.width > 0 &&
    dims.height > 0;
  const livePrice =
    inlineSqm && validDims ? computeConfiguredPrice(product, dims) : undefined;

  const handlePrimaryAction = async () => {
    // Pure per-m² product → price & add inline using the entered dimensions.
    if (inlineSqm) {
      if (!validDims || livePrice == null) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setToast({ visible: true, message: "Renseignez la largeur et la hauteur", type: "error" });
        return;
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      addItem(product, 1, dims);
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
    // Simple product → straight to the cart.
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addItem(product, 1);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
    setToast({ visible: true, message: "Ajouté au panier", type: "success" });
  };

  const handleFavorite = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleFavorite(product.id);
  };

  const onGalleryScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / W);
    if (i !== galleryIndex) setGalleryIndex(i);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 190 }}
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
          <TrustItem icon="truck-outline" label="Livraison France & DOM" />
          <View style={{ width: 1, backgroundColor: COLORS.outlineVariant }} />
          <TrustItem icon="shield-check-outline" label="Garantie 2 ans" />
          <View style={{ width: 1, backgroundColor: COLORS.outlineVariant }} />
          <TrustItem icon="message-text-outline" label="Conseils dédiés" />
        </View>

        {/* ── Title + price block ──────────────────── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          <Text style={[TYPE.overline, { marginBottom: 6 }]}>
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
              <Icon name="star" size={15} color={COLORS.primary} />
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
                <Text style={[TYPE.priceLarge, { fontSize: 32 }]}>
                  {livePrice != null
                    ? formatPrice(livePrice)
                    : product.pricePerSqm != null
                      ? `${formatPrice(product.pricePerSqm)}/m²`
                      : "Sur mesure"}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.outline, marginTop: 4 }}>
                  {livePrice != null && dims
                    ? `Soit ${formatPrice(product.pricePerSqm ?? 0)}/m² · ${dims.width} × ${dims.height} cm`
                    : "Indiquez vos dimensions ci-dessous pour obtenir le prix"}
                </Text>
              </View>
            ) : product.price ? (
              <View>
                <Text style={[TYPE.priceLarge, { fontSize: 32 }]}>{formatPrice(product.price)}</Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.outline, marginTop: 2 }}>
                  Dès {formatPrice(Math.round(product.price / 4))}/mois en 4× sans frais
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Made-to-measure calculator (per-m² products) ─── */}
        {inlineSqm && (
          <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
            <Text style={{ fontSize: 20, fontFamily: FONTS.serif, color: COLORS.onSurface, marginBottom: 4 }}>
              Vos dimensions
            </Text>
            <Text style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.outline, marginBottom: 12 }}>
              Entrez la largeur et la hauteur souhaitées — le prix se calcule automatiquement.
            </Text>
            <View style={{ backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 16, ...SHADOW.card }}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Input label="LARGEUR" value={customWidth} onChangeText={setCustomWidth} keyboardType="numeric" suffix="cm" />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label="HAUTEUR" value={customHeight} onChangeText={setCustomHeight} keyboardType="numeric" suffix="cm" />
                </View>
              </View>
              {product.minDimensions && product.maxDimensions && (
                <Text style={{ fontSize: 12, fontFamily: FONTS.body, color: COLORS.outline, marginTop: 4 }}>
                  De {product.minDimensions.width}×{product.minDimensions.height} à{" "}
                  {product.maxDimensions.width}×{product.maxDimensions.height} cm
                </Text>
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
                <Text style={[TYPE.price, { fontSize: 24 }]}>
                  {livePrice != null ? formatPrice(livePrice) : "—"}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── À propos ─────────────────────────────── */}
        <Section title="À propos">
          <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: COLORS.onSurface, lineHeight: 20 }}>
            {product.description}
          </Text>
        </Section>

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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 16 }}>
              {popular
                .filter((p) => p.id !== product.id)
                .slice(0, 6)
                .map((p) => {
                  const img = getProductImage(p.images[0]);
                  return (
                    <PressableScale
                      key={p.id}
                      onPress={() => router.push(`/(main)/products/${p.id}`)}
                      style={{ width: 130 }}
                    >
                      <View
                        style={{
                          width: 130,
                          height: 150,
                          borderRadius: 16,
                          overflow: "hidden",
                          backgroundColor: COLORS.surfaceContainer,
                          marginBottom: 8,
                          ...SHADOW.soft,
                        }}
                      >
                        {img && <Image source={img} style={{ width: "100%", height: "100%" }} resizeMode="cover" />}
                      </View>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: COLORS.onSurface }} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={[TYPE.price, { fontSize: 16, marginTop: 1 }]}>
                        {priceTagLabel(p)}
                      </Text>
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
          paddingBottom: 28,
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
              +1 dans le panier
            </Text>
          </Animated.View>
        )}

        {/* Stacked full-width CTAs: devis (yellow) then commander (blue). */}
        <TouchableOpacity
          onPress={() => setDevisOpen(true)}
          activeOpacity={0.85}
          style={{
            backgroundColor: COLORS.surfaceContainerLowest,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: COLORS.primary,
            paddingVertical: 14,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <Icon name="file-document-outline" size={18} color={COLORS.primary} />
          <Text style={{ fontSize: 15, fontFamily: "Manrope_700Bold", color: COLORS.primary }}>
            Demander un devis
          </Text>
        </TouchableOpacity>

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
        />
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

      <FloatingContactButton onPress={() => setContactOpen(true)} />
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
          backgroundColor: COLORS.primary,
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


