import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { COLORS, PRODUCT_TYPES, TERRITORIES } from "../../../lib/constants";
import { formatPrice } from "../../../lib/utils";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Toast from "../../../components/ui/Toast";
import { getProductImage } from "../../../lib/mock-data";
import { useCartStore } from "../../../features/cart/store";
import { useFavoritesStore } from "../../../features/favorites/store";
import { useProduct, usePopularProducts } from "../../../features/products/hooks";
import type { Product } from "../../../lib/types";

const { width: W, height: H } = Dimensions.get("window");
const GALLERY_H = Math.min(W, H * 0.55);

type Territory = (typeof TERRITORIES)[number]["value"];

// ─── Mocked review data (deterministic from product id) ──
const REVIEWERS = ["Sophie L.", "Karim B.", "Léa M.", "Vincent R.", "Amina T."];
const REVIEW_TEXTS = [
  "Qualité au rendez-vous, finition impeccable. Je recommande sans hésiter.",
  "Le rendu est encore plus beau qu'en photo. Livraison en 3 semaines en métropole.",
  "Service client réactif, équipe à l'écoute pour les ajustements sur mesure.",
];

function deriveRating(product: Product) {
  const seed = product.id.charCodeAt(0) + product.id.charCodeAt(product.id.length - 1);
  const value = 4 + ((seed % 10) / 10) * 0.9; // 4.0 – 4.9
  return Math.round(value * 10) / 10;
}

function deriveReviewCount(product: Product) {
  return ((product.id.charCodeAt(0) * 7) % 380) + 24;
}

function deriveSold(product: Product) {
  return ((product.id.charCodeAt(1) * 11) % 980) + 20;
}

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
  const [territory, setTerritory] = useState<Territory>("metropole");
  const [activeTab, setActiveTab] = useState<"overview" | "specs" | "reviews">("overview");
  const [toast, setToast] = useState({ visible: false, message: "", type: "success" as const });
  const galleryRef = useRef<ScrollView>(null);

  const rating = useMemo(() => (product ? deriveRating(product) : 0), [product]);
  const reviewCount = useMemo(() => (product ? deriveReviewCount(product) : 0), [product]);
  const soldCount = useMemo(() => (product ? deriveSold(product) : 0), [product]);

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

  const isQuoteOnly = product.productType === PRODUCT_TYPES.QUOTE_ONLY;
  const isConfigurable = product.productType === PRODUCT_TYPES.CONFIGURABLE;
  const galleryImages = product.images.length > 0 ? product.images : ["__placeholder__"];

  const handleAddToCart = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const dims = isConfigurable && customWidth && customHeight
      ? { width: parseFloat(customWidth), height: parseFloat(customHeight) }
      : undefined;
    addItem(product, quantity, dims);
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
                <CircleButton icon="share-variant" onPress={() => {}} />
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
            { id: "reviews", label: `Avis (${reviewCount})` },
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

          {/* Rating row */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
            <View style={{ flexDirection: "row", gap: 1 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <MaterialCommunityIcons
                  key={i}
                  name={i < Math.floor(rating) ? "star" : i < rating ? "star-half-full" : "star-outline"}
                  size={14}
                  color={COLORS.secondary}
                />
              ))}
            </View>
            <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: COLORS.onSurface }}>
              {rating}
            </Text>
            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.outline }}>
              · {reviewCount} avis · {soldCount}+ vendus
            </Text>
          </View>

          {/* Price */}
          <View style={{ marginTop: 16, marginBottom: 4 }}>
            {isQuoteOnly ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text
                  style={{
                    fontSize: 22,
                    fontFamily: "Manrope_800ExtraBold",
                    color: COLORS.secondary,
                    fontStyle: "italic",
                  }}
                >
                  Sur devis
                </Text>
                <View
                  style={{
                    backgroundColor: `${COLORS.secondary}1A`,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 4,
                  }}
                >
                  <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: COLORS.secondary, letterSpacing: 0.5 }}>
                    SUR MESURE
                  </Text>
                </View>
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
                  {formatPrice(product.price)}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.outline, marginTop: 2 }}>
                  Dès {formatPrice(Math.round(product.price / 4))}/mois en 4× sans frais
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

            {/* Configurable dimensions */}
            {isConfigurable && (
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
                {product.dimensions && (
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
            <SpecRow label="Type de produit" value={isQuoteOnly ? "Devis personnalisé" : isConfigurable ? "Configurable" : "Standard"} />
            <SpecRow label="Métropole" value={product.deliveryEstimates.metropole} />
            <SpecRow label="Outre-mer" value={product.deliveryEstimates.outreMer} />
            <SpecRow label="Référence" value={product.id.toUpperCase()} last />
          </View>
        )}

        {activeTab === "reviews" && (
          <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            {/* Rating summary */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 16,
                padding: 16,
                borderRadius: 12,
                backgroundColor: "#fff",
                marginBottom: 16,
              }}
            >
              <View>
                <Text style={{ fontSize: 36, fontFamily: "Manrope_800ExtraBold", color: COLORS.onSurface }}>
                  {rating}
                </Text>
                <View style={{ flexDirection: "row", gap: 1, marginTop: 2 }}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <MaterialCommunityIcons
                      key={i}
                      name={i < Math.floor(rating) ? "star" : i < rating ? "star-half-full" : "star-outline"}
                      size={14}
                      color={COLORS.secondary}
                    />
                  ))}
                </View>
              </View>
              <View style={{ flex: 1 }}>
                {[5, 4, 3, 2, 1].map((stars) => {
                  const ratio = stars === Math.round(rating) ? 0.7 : stars > Math.round(rating) ? 0.05 : 0.15;
                  return (
                    <View key={stars} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <Text style={{ fontSize: 10, color: COLORS.outline, width: 8, fontFamily: "Inter_500Medium" }}>
                        {stars}
                      </Text>
                      <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: COLORS.surfaceContainer }}>
                        <View
                          style={{
                            width: `${ratio * 100}%`,
                            height: "100%",
                            borderRadius: 2,
                            backgroundColor: COLORS.secondary,
                          }}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {[0, 1, 2].map((i) => (
              <ReviewCard
                key={i}
                name={REVIEWERS[(product.id.charCodeAt(0) + i) % REVIEWERS.length]}
                stars={5 - (i % 2)}
                text={REVIEW_TEXTS[i % REVIEW_TEXTS.length]}
              />
            ))}

            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: COLORS.outlineVariant,
                marginTop: 4,
              }}
            >
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: COLORS.onSurface }}>
                Voir les {reviewCount} avis
              </Text>
              <MaterialCommunityIcons name="arrow-right" size={14} color={COLORS.onSurface} />
            </TouchableOpacity>
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
                        {p.price ? formatPrice(p.price) : "Sur devis"}
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
        {isQuoteOnly ? (
          <View style={{ flex: 1 }}>
            <Button
              label="Demander un devis"
              onPress={() => router.push(`/(main)/quote-request/${product.id}`)}
              size="md"
            />
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <Button label="Ajouter au panier" onPress={handleAddToCart} size="md" />
          </View>
        )}
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

function ReviewCard({ name, stars, text }: { name: string; stars: number; text: string }) {
  return (
    <View style={{ padding: 14, borderRadius: 12, backgroundColor: "#fff", marginBottom: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: COLORS.onSurface }}>{name}</Text>
        <View style={{ flexDirection: "row", gap: 1 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <MaterialCommunityIcons
              key={i}
              name={i < stars ? "star" : "star-outline"}
              size={12}
              color={COLORS.secondary}
            />
          ))}
        </View>
      </View>
      <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.onSurface, lineHeight: 18 }}>
        {text}
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
