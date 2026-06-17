import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Keyboard,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../../lib/constants";
import {
  PRODUCT_IMAGES,
  getProductImage,
} from "../../../lib/mock-data";
import { formatPrice } from "../../../lib/utils";
import { useSearchStore } from "../../../features/search/store";
import {
  useCategories,
  usePopularProducts,
  useSearchProducts,
} from "../../../features/products/hooks";
import Toast from "../../../components/ui/Toast";

const { width: W } = Dimensions.get("window");
const PAGE_PAD = 16;
const CAT_GAP = 10;
const CAT_W = (W - PAGE_PAD * 2 - CAT_GAP) / 2;

const CATEGORY_COVERS: Record<string, any> = {
  "1": PRODUCT_IMAGES.portePivotante,
  "2": PRODUCT_IMAGES.cuisineLuxeIlot,
  "3": PRODUCT_IMAGES.canapeModulable,
  "4": PRODUCT_IMAGES.chambreRoyale,
  "5": PRODUCT_IMAGES.baieCoulissante,
  "6": PRODUCT_IMAGES.buffetMiroir,
};

const POPULAR_QUERIES = [
  "Cuisine îlot",
  "Porte d'entrée",
  "Canapé",
  "Chambre complète",
  "Baie vitrée",
  "Décoration",
];

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ image?: string }>();
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState({ visible: false, message: "" });
  const recent = useSearchStore((s) => s.recent);
  const pushRecent = useSearchStore((s) => s.pushRecent);
  const clearRecent = useSearchStore((s) => s.clearRecent);

  const trimmed = query.trim();
  const searchQuery = useSearchProducts(trimmed);
  const { data: categories = [] } = useCategories();
  const { data: popular = [] } = usePopularProducts(8);

  // Visual / image search is not yet available — show a notice instead of
  // fabricating ML results.
  useEffect(() => {
    if (params.image) {
      setToast({ visible: true, message: "Recherche par image bientôt disponible" });
    }
  }, [params.image]);

  const launchPicker = async () => {
    setToast({ visible: true, message: "Recherche par image bientôt disponible" });
  };

  const results = useMemo(
    () => searchQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [searchQuery.data],
  );
  const isSearching = trimmed.length > 2 && searchQuery.isLoading;

  const open = (productId: string) => {
    pushRecent(query);
    Keyboard.dismiss();
    router.push(`/(main)/products/${productId}`);
  };

  const openCategory = (catId: string) => {
    Keyboard.dismiss();
    router.push(`/(main)/categories/${catId}`);
  };

  const trending = popular.slice(0, 4);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* ── Header ─────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 10,
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 9999,
            backgroundColor: "#fff",
          }}
        >
          <MaterialCommunityIcons name="magnify" size={18} color={COLORS.outline} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher un produit, une catégorie…"
            placeholderTextColor={COLORS.outline}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => pushRecent(query)}
            style={{
              flex: 1,
              fontSize: 14,
              fontFamily: "Inter_400Regular",
              color: COLORS.onSurface,
            }}
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={() => setQuery("")}>
              <MaterialCommunityIcons name="close-circle" size={16} color={COLORS.outline} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={launchPicker} hitSlop={8}>
              <MaterialCommunityIcons name="camera-outline" size={20} color={COLORS.onSurface} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {query.trim() === "" ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Recent searches ────────────────── */}
          {recent.length > 0 && (
            <View style={{ paddingHorizontal: PAGE_PAD, marginTop: 6 }}>
              <SectionHeader
                title="Recherches récentes"
                actionLabel="Effacer"
                onAction={clearRecent}
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {recent.map((q) => (
                  <TouchableOpacity
                    key={q}
                    onPress={() => setQuery(q)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingLeft: 12,
                      paddingRight: 10,
                      paddingVertical: 7,
                      borderRadius: 9999,
                      backgroundColor: "#fff",
                    }}
                  >
                    <MaterialCommunityIcons name="history" size={12} color={COLORS.outline} />
                    <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: COLORS.onSurface }}>
                      {q}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ── Popular queries ────────────────── */}
          <View style={{ paddingHorizontal: PAGE_PAD, marginTop: 22 }}>
            <SectionHeader title="Recherches populaires" />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {POPULAR_QUERIES.map((q, i) => (
                <TouchableOpacity
                  key={q}
                  onPress={() => setQuery(q)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingLeft: 10,
                    paddingRight: 12,
                    paddingVertical: 7,
                    borderRadius: 9999,
                    backgroundColor: "#fff",
                  }}
                >
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: i < 3 ? COLORS.secondary : COLORS.surfaceContainer,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontFamily: "Inter_700Bold",
                        color: i < 3 ? "#fff" : COLORS.outline,
                      }}
                    >
                      {i + 1}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: COLORS.onSurface }}>
                    {q}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Categories grid ────────────────── */}
          <View style={{ marginTop: 24 }}>
            <View style={{ paddingHorizontal: PAGE_PAD }}>
              <SectionHeader title="Parcourir par catégorie" />
            </View>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                paddingHorizontal: PAGE_PAD,
                gap: CAT_GAP,
              }}
            >
              {categories.map((cat) => {
                const cover = CATEGORY_COVERS[cat.id] ?? getProductImage(cat.image);
                const count = cat.productCount ?? 0;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    activeOpacity={0.92}
                    onPress={() => openCategory(cat.id)}
                    style={{
                      width: CAT_W,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      padding: 8,
                      backgroundColor: "#fff",
                      borderRadius: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 10,
                        overflow: "hidden",
                        backgroundColor: COLORS.surfaceContainer,
                      }}
                    >
                      {cover && (
                        <Image source={cover} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 13,
                          fontFamily: "Inter_600SemiBold",
                          color: COLORS.onSurface,
                        }}
                        numberOfLines={1}
                      >
                        {cat.name}
                      </Text>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: COLORS.outline }}>
                        {count} article{count > 1 ? "s" : ""}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Trending products ──────────────── */}
          {trending.length > 0 && (
            <View style={{ marginTop: 26 }}>
              <View style={{ paddingHorizontal: PAGE_PAD }}>
                <SectionHeader title="Tendances" />
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: 12 }}
                keyboardShouldPersistTaps="handled"
              >
                {trending.map((p) => {
                  const img = getProductImage(p.images[0]);
                  return (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => open(p.id)}
                      activeOpacity={0.92}
                      style={{ width: 140 }}
                    >
                      <View
                        style={{
                          width: 140,
                          height: 140,
                          borderRadius: 12,
                          overflow: "hidden",
                          backgroundColor: COLORS.surfaceContainer,
                          marginBottom: 6,
                        }}
                      >
                        {img && <Image source={img} style={{ width: "100%", height: "100%" }} resizeMode="cover" />}
                      </View>
                      <Text
                        style={{
                          fontSize: 12,
                          fontFamily: "Inter_500Medium",
                          color: COLORS.onSurface,
                        }}
                        numberOfLines={1}
                      >
                        {p.name}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          fontFamily: "Manrope_700Bold",
                          color: COLORS.secondary,
                          marginTop: 1,
                        }}
                      >
                        {p.price ? formatPrice(p.price) : "Sur devis"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: PAGE_PAD, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {isSearching ? (
            <View style={{ paddingTop: 60, alignItems: "center" }}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : results.length === 0 ? (
            <View style={{ paddingTop: 60, alignItems: "center" }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: COLORS.surfaceContainer,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 12,
                }}
              >
                <MaterialCommunityIcons name="magnify-close" size={26} color={COLORS.outline} />
              </View>
              <Text style={{ fontSize: 14, color: COLORS.onSurface, fontFamily: "Inter_600SemiBold" }}>
                Aucun résultat pour « {query} »
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: COLORS.outline,
                  fontFamily: "Inter_400Regular",
                  marginTop: 4,
                  textAlign: "center",
                  paddingHorizontal: 32,
                }}
              >
                Essayez un autre terme ou parcourez par catégorie.
              </Text>
            </View>
          ) : (
            results.map((item, i) => {
              const img = getProductImage(item.images[0]);
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => open(item.id)}
                  style={{
                    flexDirection: "row",
                    gap: 12,
                    padding: 12,
                    backgroundColor: "#fff",
                    borderRadius: 12,
                    marginBottom: 8,
                  }}
                >
                  {img && <Image source={img} style={{ width: 56, height: 56, borderRadius: 8 }} resizeMode="cover" />}
                  <View style={{ flex: 1, justifyContent: "center" }}>
                    <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: COLORS.onSurface }} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: COLORS.outline }}>
                      {item.category.name}
                    </Text>
                    <Text style={{ fontSize: 13, fontFamily: "Manrope_700Bold", color: COLORS.secondary, marginTop: 2 }}>
                      {item.price ? formatPrice(item.price) : "Sur devis"}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      <Toast
        message={toast.message}
        type="info"
        visible={toast.visible}
        onDismiss={() => setToast((p) => ({ ...p, visible: false }))}
      />
    </SafeAreaView>
  );
}

function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontFamily: "Inter_600SemiBold",
          color: COLORS.outline,
          textTransform: "uppercase",
          letterSpacing: 1.5,
        }}
      >
        {title}
      </Text>
      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction}>
          <Text style={{ fontSize: 12, color: COLORS.secondary, fontFamily: "Inter_500Medium" }}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
