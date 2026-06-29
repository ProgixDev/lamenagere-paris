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
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  interpolateColor,
  scrollTo,
  runOnJS,
  runOnUI,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { COLORS, PRODUCT_TYPES, PRICE_MODES } from "../../../lib/constants";
import { formatPrice } from "../../../lib/utils";
import { priceTagLabel } from "../../../lib/pricing";
import Button from "../../../components/ui/Button";
import PressableScale from "../../../components/ui/PressableScale";
import Toast from "../../../components/ui/Toast";
import ContactSellerSheet from "../../../components/product/ContactSellerSheet";
import DevisRequestSheet from "../../../components/product/DevisRequestSheet";
import ProductOptionsPreview from "../../../components/product/ProductOptionsPreview";
import { getProductImage } from "../../../lib/mock-data";
import { useCartStore } from "../../../features/cart/store";
import { useFavoritesStore } from "../../../features/favorites/store";
import { useProduct, usePopularProducts } from "../../../features/products/hooks";

const { width: W, height: H } = Dimensions.get("window");
const GALLERY_H = Math.min(W, H * 0.55);


// ────────────────────────────────────────────────────────
export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: product, isLoading } = useProduct(id);
  const { data: popular = [] } = usePopularProducts(12);

  const addItem = useCartStore((s) => s.addItem);
  const isFavorited = useFavoritesStore((s) => s.favorites.includes(id));
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);

  const [galleryIndex, setGalleryIndex] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [contactOpen, setContactOpen] = useState(false);
  const [devisOpen, setDevisOpen] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "success" as "success" | "error",
  });
  const galleryRef = useRef<ScrollView>(null);

  // Swipeable Aperçu ⇆ Caractéristiques tabs (reanimated paged view).
  const pagerRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const page0H = useSharedValue(0);
  const page1H = useSharedValue(0);
  const TAB_W = W / 2;

  const onPagerScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
    onMomentumEnd: (e) => {
      runOnJS(setActiveIndex)(Math.round(e.contentOffset.x / W));
    },
  });
  const goToTab = (i: number) => {
    setActiveIndex(i);
    runOnUI(() => {
      "worklet";
      scrollTo(pagerRef, i * W, 0, true);
    })();
  };
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(scrollX.value, [0, W], [0, TAB_W]) }],
  }));
  const label0Style = useAnimatedStyle(() => ({
    color: interpolateColor(scrollX.value, [0, W], [COLORS.onSurface, COLORS.outline]),
  }));
  const label1Style = useAnimatedStyle(() => ({
    color: interpolateColor(scrollX.value, [0, W], [COLORS.outline, COLORS.onSurface]),
  }));
  const pagerHeightStyle = useAnimatedStyle(() => {
    const h0 = page0H.value;
    const h1 = page1H.value;
    if (h0 <= 0 || h1 <= 0) return {};
    return { height: interpolate(scrollX.value, [0, W], [h0, h1]) };
  });

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
  const galleryImages = product.images.length > 0 ? product.images : ["__placeholder__"];

  // Products that need any choice (dimensions, opening, or config blocks) are
  // configured in the dedicated guided flow rather than inline on this page.
  const hasConfiguration =
    needsDimensions || hasOpeningTypes || configBlocks.length > 0;

  const handlePrimaryAction = async () => {
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
        stickyHeaderIndices={[2]}
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
            {galleryImages.map((key, idx) => {
              const src = getProductImage(key);
              return (
                <View key={`${key}-${idx}`} style={{ width: W, height: GALLERY_H, alignItems: "center", justifyContent: "center" }}>
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
          {galleryImages.length > 1 && (
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
                {galleryIndex + 1} / {galleryImages.length}
              </Text>
            </View>
          )}
        </View>

        {/* ── Trust strip ──────────────────────────── */}
        <View
          style={{
            flexDirection: "row",
            paddingVertical: 10,
            paddingHorizontal: 16,
            backgroundColor: "#FFF7ED",
            gap: 14,
          }}
        >
          <TrustItem icon="truck-outline" label="Livraison France & DOM" />
          <View style={{ width: 1, backgroundColor: COLORS.outlineVariant }} />
          <TrustItem icon="shield-check-outline" label="Garantie 2 ans" />
          <View style={{ width: 1, backgroundColor: COLORS.outlineVariant }} />
          <TrustItem icon="message-text-outline" label="Conseils dédiés" />
        </View>

        {/* ── Sticky swipeable tab bar ─────────────── */}
        <View
          style={{
            backgroundColor: COLORS.background,
            borderBottomWidth: 1,
            borderBottomColor: `${COLORS.outlineVariant}66`,
            paddingTop: 8,
          }}
        >
          <View style={{ flexDirection: "row" }}>
            {(["Aperçu", "Caractéristiques"] as const).map((label, i) => (
              <TouchableOpacity
                key={label}
                onPress={() => goToTab(i)}
                activeOpacity={0.7}
                style={{ flex: 1, alignItems: "center", paddingVertical: 10 }}
              >
                <Animated.Text
                  style={[
                    {
                      fontSize: 14,
                      fontFamily: i === activeIndex ? "Manrope_700Bold" : "Inter_500Medium",
                    },
                    i === 0 ? label0Style : label1Style,
                  ]}
                >
                  {label}
                </Animated.Text>
              </TouchableOpacity>
            ))}
          </View>
          <Animated.View
            style={[
              {
                position: "absolute",
                bottom: 0,
                left: TAB_W / 2 - 24,
                width: 48,
                height: 3,
                borderRadius: 2,
                backgroundColor: COLORS.primary,
              },
              indicatorStyle,
            ]}
          />
        </View>

        {/* ── Title + price block ──────────────────── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          <Text
            style={{
              fontSize: 11,
              fontFamily: "Inter_500Medium",
              color: COLORS.outline,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              marginBottom: 4,
            }}
          >
            {product.category.name}
          </Text>
          <Text
            style={{
              fontSize: 22,
              fontFamily: "Manrope_700Bold",
              color: COLORS.onSurface,
              lineHeight: 28,
            }}
          >
            {product.name}
          </Text>
          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.outline, marginTop: 2 }}>
            par La Ménagère Paris
          </Text>

          {/* Price — starting price; the full total is computed in the configure flow. */}
          <View style={{ marginTop: 16, marginBottom: 4 }}>
            {isPerSqm ? (
              <View>
                <Text style={{ fontSize: 28, fontFamily: "Manrope_800ExtraBold", color: COLORS.secondary }}>
                  {product.pricePerSqm != null ? `${formatPrice(product.pricePerSqm)}/m²` : "Sur mesure"}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.outline, marginTop: 2 }}>
                  Prix calculé selon vos dimensions
                </Text>
              </View>
            ) : product.price ? (
              <View>
                <Text style={{ fontSize: 28, fontFamily: "Manrope_800ExtraBold", color: COLORS.secondary }}>
                  {hasConfiguration ? `À partir de ${formatPrice(product.price)}` : formatPrice(product.price)}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.outline, marginTop: 2 }}>
                  Dès {formatPrice(Math.round(product.price / 4))}/mois en 4× sans frais
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Swipeable tab content (Aperçu ⇆ Caractéristiques) ─── */}
        <Animated.View style={[{ overflow: "hidden" }, pagerHeightStyle]}>
          <Animated.ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onPagerScroll}
            scrollEventThrottle={16}
          >
            <View
              style={{ width: W }}
              onLayout={(e) => {
                page0H.value = e.nativeEvent.layout.height;
              }}
            >
            <Section title="À propos">
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: "Inter_400Regular",
                  color: COLORS.onSurface,
                  lineHeight: 20,
                }}
              >
                {product.description}
              </Text>
            </Section>

            {/* Read-only showcase of the options (colors, shapes, accessories…). */}
            <ProductOptionsPreview blocks={configBlocks} />

            </View>

            <View
              style={{ width: W }}
              onLayout={(e) => {
                page1H.value = e.nativeEvent.layout.height;
              }}
            >
              <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            <SpecRow label="Catégorie" value={product.category.name} />
            {product.dimensions && (
              <SpecRow
                label="Dimensions"
                value={`${product.dimensions.width}×${product.dimensions.height}${product.dimensions.depth ? `×${product.dimensions.depth}` : ""} ${product.dimensions.unit}`}
              />
            )}
            <SpecRow label="Sur mesure" value={product.customizable ? "Oui" : "Non"} />
            <SpecRow label="Type de produit" value={needsDimensions ? "Sur mesure" : "Standard"} />
            <SpecRow label="Métropole" value={product.deliveryEstimates.metropole} />
            <SpecRow label="Outre-mer" value={product.deliveryEstimates.outreMer} />
            <SpecRow label="Référence" value={product.id.toUpperCase()} last />
              </View>
            </View>
          </Animated.ScrollView>
        </Animated.View>

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
                          height: 130,
                          borderRadius: 12,
                          overflow: "hidden",
                          backgroundColor: COLORS.surfaceContainer,
                          marginBottom: 6,
                        }}
                      >
                        {img && <Image source={img} style={{ width: "100%", height: "100%" }} resizeMode="cover" />}
                      </View>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: COLORS.onSurface }} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={{ fontSize: 13, fontFamily: "Manrope_700Bold", color: COLORS.secondary }}>
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
            backgroundColor: "#F4B400",
            borderRadius: 14,
            paddingVertical: 15,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <Icon name="file-document-outline" size={18} color={COLORS.onSurface} />
          <Text style={{ fontSize: 15, fontFamily: "Manrope_700Bold", color: COLORS.onSurface }}>
            Demander un devis
          </Text>
        </TouchableOpacity>

        <Button
          label={
            justAdded
              ? "Ajouté ✓"
              : hasConfiguration
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
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "rgba(255,255,255,0.95)",
        alignItems: "center",
        justifyContent: "center",
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
    <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
      <Text
        style={{
          fontSize: 14,
          fontFamily: "Manrope_700Bold",
          color: COLORS.onSurface,
          marginBottom: 10,
        }}
      >
        {title}
      </Text>
      <View
        style={
          noBackground
            ? undefined
            : {
                backgroundColor: "#fff",
                borderRadius: 12,
                padding: 14,
              }
        }
      >
        {children}
      </View>
    </View>
  );
}

function SpecRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: `${COLORS.outlineVariant}55`,
      }}
    >
      <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: COLORS.outline }}>{label}</Text>
      <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: COLORS.onSurface, maxWidth: "60%", textAlign: "right" }}>
        {value}
      </Text>
    </View>
  );
}

