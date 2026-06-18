import React, { useRef, useState } from "react";
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
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { COLORS, PRODUCT_TYPES, PRICE_MODES, TERRITORIES } from "../../../lib/constants";
import { formatPrice } from "../../../lib/utils";
import { computeConfiguredPrice, priceTagLabel } from "../../../lib/pricing";
import { openingTypeLabel, diagramForTypes } from "../../../lib/opening-types";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Toast from "../../../components/ui/Toast";
import { getProductImage } from "../../../lib/mock-data";
import { useCartStore } from "../../../features/cart/store";
import { useFavoritesStore } from "../../../features/favorites/store";
import { useProduct, usePopularProducts } from "../../../features/products/hooks";

const { width: W, height: H } = Dimensions.get("window");
const GALLERY_H = Math.min(W, H * 0.55);

type Territory = (typeof TERRITORIES)[number]["value"];

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
  const [quantity, setQuantity] = useState(1);
  const [customWidth, setCustomWidth] = useState("");
  const [customHeight, setCustomHeight] = useState("");
  const [openingType, setOpeningType] = useState<string | null>(null);
  const [territory, setTerritory] = useState<Territory>("metropole");
  const [activeTab, setActiveTab] = useState<"overview" | "specs">("overview");
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
  const galleryImages = product.images.length > 0 ? product.images : ["__placeholder__"];

  const dims =
    needsDimensions && customWidth && customHeight
      ? { width: parseFloat(customWidth), height: parseFloat(customHeight) }
      : undefined;

  // Live, display-only price (server re-validates at checkout).
  const livePrice = computeConfiguredPrice(product, dims, openingType ?? undefined);

  const handleAddToCart = async () => {
    if (needsDimensions && !dims) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setToast({ visible: true, message: "Renseignez vos dimensions", type: "error" });
      return;
    }
    if (hasOpeningTypes && !openingType) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setToast({ visible: true, message: "Choisissez un type d'ouverture", type: "error" });
      return;
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addItem(product, quantity, dims, openingType ?? undefined);
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

  const territoryEta =
    territory === "metropole"
      ? product.deliveryEstimates.metropole
      : product.deliveryEstimates.outreMer;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
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
                    <MaterialCommunityIcons name="image-off-outline" size={48} color={COLORS.outline} />
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

        {/* ── Sticky tab bar ───────────────────────── */}
        <View
          style={{
            flexDirection: "row",
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 8,
            backgroundColor: COLORS.background,
            borderBottomWidth: 1,
            borderBottomColor: `${COLORS.outlineVariant}66`,
            gap: 22,
          }}
        >
          {([
            { id: "overview", label: "Aperçu" },
            { id: "specs", label: "Caractéristiques" },
          ] as const).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity key={tab.id} onPress={() => setActiveTab(tab.id)} style={{ alignItems: "center" }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: isActive ? "Manrope_700Bold" : "Inter_500Medium",
                    color: isActive ? COLORS.onSurface : COLORS.outline,
                    paddingBottom: 6,
                  }}
                >
                  {tab.label}
                </Text>
                {isActive && (
                  <View
                    style={{
                      width: 18,
                      height: 3,
                      borderRadius: 2,
                      backgroundColor: COLORS.primary,
                    }}
                  />
                )}
              </TouchableOpacity>
            );
          })}
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

          {/* Price */}
          <View style={{ marginTop: 16, marginBottom: 4 }}>
            {isPerSqm ? (
              <View>
                <Text
                  style={{
                    fontSize: 28,
                    fontFamily: "Manrope_800ExtraBold",
                    color: COLORS.secondary,
                  }}
                >
                  {livePrice != null
                    ? formatPrice(livePrice)
                    : product.pricePerSqm != null
                      ? `${formatPrice(product.pricePerSqm)}/m²`
                      : "Sur mesure"}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.outline, marginTop: 2 }}>
                  {livePrice != null
                    ? `Prix pour ${customWidth}×${customHeight} cm${
                        hasOpeningTypes && openingType ? ` · ${openingTypeLabel(openingType)}` : ""
                      }`
                    : "Indiquez vos dimensions pour voir le prix"}
                </Text>
              </View>
            ) : product.price ? (
              <View>
                <Text
                  style={{
                    fontSize: 28,
                    fontFamily: "Manrope_800ExtraBold",
                    color: COLORS.secondary,
                  }}
                >
                  {formatPrice(livePrice ?? product.price)}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.outline, marginTop: 2 }}>
                  Dès {formatPrice(Math.round((livePrice ?? product.price) / 4))}/mois en 4× sans frais
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Tab content ──────────────────────────── */}
        {activeTab === "overview" && (
          <View>
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

            {/* Made-to-measure dimensions */}
            {needsDimensions && (
              <Section title="Vos dimensions souhaitées">
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="LARGEUR"
                      value={customWidth}
                      onChangeText={setCustomWidth}
                      keyboardType="numeric"
                      suffix="cm"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="HAUTEUR"
                      value={customHeight}
                      onChangeText={setCustomHeight}
                      keyboardType="numeric"
                      suffix="cm"
                    />
                  </View>
                </View>
                {isPerSqm && product.pricePerSqm != null && (
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: "Inter_500Medium",
                      color: COLORS.secondary,
                      marginTop: 8,
                    }}
                  >
                    {formatPrice(product.pricePerSqm)}/m²
                    {product.minDimensions && product.maxDimensions
                      ? ` · de ${product.minDimensions.width}×${product.minDimensions.height} à ${product.maxDimensions.width}×${product.maxDimensions.height} cm`
                      : ""}
                  </Text>
                )}
                {!isPerSqm && product.dimensions && (
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: "Inter_400Regular",
                      color: COLORS.outline,
                      marginTop: 6,
                    }}
                  >
                    Référence : {product.dimensions.width}×{product.dimensions.height}{" "}
                    {product.dimensions.unit}
                  </Text>
                )}
              </Section>
            )}

            {/* Opening type selector */}
            {hasOpeningTypes && (
              <Section title="Type d'ouverture">
                {(() => {
                  const diagram = diagramForTypes(openingTypes.map((o) => o.type));
                  return diagram ? (
                    <Image
                      source={diagram}
                      style={{
                        width: "100%",
                        height: 150,
                        borderRadius: 12,
                        marginBottom: 12,
                        backgroundColor: COLORS.surfaceContainer,
                      }}
                      resizeMode="contain"
                    />
                  ) : null;
                })()}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {openingTypes.map((opt) => {
                    const active = openingType === opt.type;
                    return (
                      <TouchableOpacity
                        key={opt.type}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setOpeningType(opt.type);
                        }}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 9,
                          borderRadius: 9999,
                          backgroundColor: active ? COLORS.primary : "transparent",
                          borderWidth: 1,
                          borderColor: active ? COLORS.primary : COLORS.outlineVariant,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontFamily: active ? "Inter_600SemiBold" : "Inter_500Medium",
                            color: active ? COLORS.onPrimary : COLORS.onSurface,
                          }}
                        >
                          {openingTypeLabel(opt.type)}
                          {opt.surcharge > 0 ? ` +${formatPrice(opt.surcharge)}` : ""}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Section>
            )}

            {/* Delivery */}
            <Section title="Livraison estimée">
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {TERRITORIES.map((t) => {
                  const active = territory === t.value;
                  return (
                    <TouchableOpacity
                      key={t.value}
                      onPress={() => setTerritory(t.value as Territory)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 9999,
                        backgroundColor: active ? COLORS.primary : "#fff",
                        borderWidth: 1,
                        borderColor: active ? COLORS.primary : COLORS.outlineVariant,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontFamily: active ? "Inter_600SemiBold" : "Inter_500Medium",
                          color: active ? "#fff" : COLORS.onSurface,
                        }}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  padding: 12,
                  borderRadius: 10,
                  backgroundColor: "#fff",
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    backgroundColor: `${COLORS.primary}15`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialCommunityIcons
                    name={territory === "metropole" ? "truck-outline" : "ferry"}
                    size={20}
                    color={COLORS.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: COLORS.onSurface }}>
                    {territoryEta}
                  </Text>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: COLORS.outline }}>
                    Livraison à domicile · suivi en temps réel
                  </Text>
                </View>
              </View>
            </Section>
          </View>
        )}

        {activeTab === "specs" && (
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
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => router.push(`/(main)/products/${p.id}`)}
                      activeOpacity={0.92}
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
                    </TouchableOpacity>
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
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          borderTopWidth: 1,
          borderTopColor: `${COLORS.outlineVariant}80`,
        }}
      >
        <FooterIconButton
          icon={isFavorited ? "heart" : "heart-outline"}
          color={isFavorited ? "#E74040" : COLORS.onSurface}
          label="Favoris"
          onPress={handleFavorite}
        />
        <FooterIconButton
          icon="message-outline"
          color={COLORS.onSurface}
          label="Contact"
          onPress={() => router.push("/(tabs)/messages")}
        />
        <View style={{ flex: 1 }}>
          <Button label="Ajouter au panier" onPress={handleAddToCart} size="md" />
        </View>
      </View>

      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onDismiss={() => setToast((p) => ({ ...p, visible: false }))}
      />
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────
function CircleButton({ icon, onPress }: { icon: any; onPress: () => void }) {
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
      <MaterialCommunityIcons name={icon} size={20} color={COLORS.onSurface} />
    </TouchableOpacity>
  );
}

function TrustItem({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
      <MaterialCommunityIcons name={icon} size={16} color={COLORS.success} />
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

function FooterIconButton({
  icon,
  color,
  label,
  onPress,
}: {
  icon: any;
  color: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{ width: 56, alignItems: "center", justifyContent: "center", paddingVertical: 6 }}
    >
      <MaterialCommunityIcons name={icon} size={22} color={color} />
      <Text style={{ fontSize: 9, fontFamily: "Inter_500Medium", color: COLORS.outline, marginTop: 2 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
