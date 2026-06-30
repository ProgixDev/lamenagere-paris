import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { COLORS } from "../../../lib/constants";
import { FONTS, TYPE, SHADOW } from "../../../lib/typography";
import { priceTagLabel } from "../../../lib/pricing";
import type { Product } from "../../../lib/types";
import EmptyState from "../../../components/ui/EmptyState";
import {
  getProductImage,
  PRODUCT_IMAGES,
} from "../../../lib/mock-data";
import { useFavoritesStore } from "../../../features/favorites/store";
import {
  useCategories,
  useCategoryFeatured,
  useProductsByCategory,
} from "../../../features/products/hooks";

const { width: W } = Dimensions.get("window");
const CARD_W = (W - 20 * 2 - 12) / 2;

// Hero images per category
const CATEGORY_HEROES: Record<string, any> = {
  "1": PRODUCT_IMAGES.portePrestige,
  "2": PRODUCT_IMAGES.cuisineLuxeIlot,
  "3": PRODUCT_IMAGES.canapeBordeaux,
  "4": PRODUCT_IMAGES.chambreRoyale,
  "5": PRODUCT_IMAGES.baieCoulissante,
  "6": PRODUCT_IMAGES.buffetMiroir,
};

function ProductCard({ product, index }: { product: Product; index: number }) {
  const router = useRouter();
  const toggleFav = useFavoritesStore((s) => s.toggleFavorite);
  const isFav = useFavoritesStore((s) => s.favorites.includes(product.id));
  const imgSource = getProductImage(product.images[0]);

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={() => router.push(`/(main)/products/${product.id}`)}
      style={{
        width: CARD_W,
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor: COLORS.surfaceContainerLowest,
        marginBottom: 12,
        ...SHADOW.card,
      }}
    >
      {/* Image — consistent 4:5 portrait */}
      <View style={{ width: "100%", height: CARD_W * 1.25, backgroundColor: COLORS.surfaceContainer }}>
        {imgSource && (
          <Image
            source={imgSource}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        )}
        {/* Favorite */}
        <TouchableOpacity
          onPress={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            toggleFav(product.id);
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 2,
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: "rgba(255,255,255,0.92)",
            alignItems: "center",
            justifyContent: "center",
            ...SHADOW.soft,
          }}
        >
          <MaterialCommunityIcons
            name={isFav ? "heart" : "heart-outline"}
            size={16}
            color={isFav ? "#C0392B" : COLORS.onSurfaceVariant}
          />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 14 }}>
        <Text
          style={{ fontSize: 13, lineHeight: 18, fontFamily: FONTS.bodyMedium, color: COLORS.onSurface, marginBottom: 3 }}
          numberOfLines={1}
        >
          {product.name}
        </Text>
        <Text
          style={{ fontSize: 11, fontFamily: FONTS.body, color: COLORS.onSurfaceVariant, marginBottom: 6 }}
          numberOfLines={1}
        >
          par La Ménagère Paris
        </Text>
        <Text style={[TYPE.price, { fontSize: 19 }]}>
          {priceTagLabel(product)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── "Notre sélection" rail (admin-curated, ordered) ──────
function SelectionRail({ products }: { products: Product[] }) {
  const router = useRouter();
  if (products.length === 0) return null;
  return (
    <View style={{ paddingTop: 20 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 20,
          marginBottom: 12,
        }}
      >
        <MaterialCommunityIcons name="star" size={16} color={COLORS.primary} />
        <Text style={[TYPE.sectionTitle, { fontSize: 20, lineHeight: 24 }]}>
          Notre sélection
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
      >
        {products.map((product) => {
          const source = getProductImage(product.images[0]);
          return (
            <TouchableOpacity
              key={product.id}
              activeOpacity={0.92}
              onPress={() => router.push(`/(main)/products/${product.id}`)}
              style={{ width: 150 }}
            >
              <View
                style={{
                  width: 150,
                  height: 188,
                  borderRadius: 16,
                  overflow: "hidden",
                  backgroundColor: COLORS.surfaceContainer,
                  ...SHADOW.card,
                }}
              >
                {source && (
                  <Image source={source} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                )}
              </View>
              <Text
                numberOfLines={2}
                style={{ fontSize: 13, fontFamily: FONTS.bodyMedium, color: COLORS.onSurface, marginTop: 8 }}
              >
                {product.name}
              </Text>
              <Text style={[TYPE.price, { fontSize: 18, marginTop: 3 }]}>
                {priceTagLabel(product)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const NEAR_BOTTOM_PX = 600;

export default function CategoryProductsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: categories } = useCategories();
  const { data: selection = [] } = useCategoryFeatured(id);
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useProductsByCategory(id);

  const category = categories?.find((c) => c.id === id);
  const products = useMemo<Product[]>(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );
  const heroImage = CATEGORY_HEROES[id];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const distanceFromBottom =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      if (distanceFromBottom < NEAR_BOTTOM_PX && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onScroll={onScroll}
        scrollEventThrottle={64}
      >
        {/* Hero header with image */}
        <View>
          {heroImage && (
            <Image source={heroImage} style={{ width: W, height: 220 }} resizeMode="cover" />
          )}
          <LinearGradient
            colors={["rgba(0,0,0,0.35)", "transparent", "rgba(0,0,0,0.4)"]}
            locations={[0, 0.4, 1]}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          />

          {/* Nav */}
          <SafeAreaView edges={["top"]} style={{ position: "absolute", top: 0, left: 0, right: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8 }}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.3)", alignItems: "center", justifyContent: "center" }}
              >
                <MaterialCommunityIcons name="chevron-left" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/(main)/search")}
                style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.3)", alignItems: "center", justifyContent: "center" }}
              >
                <MaterialCommunityIcons name="magnify" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          {/* Category title overlay */}
          <View style={{ position: "absolute", bottom: 16, left: 20, right: 20 }}>
            <Text style={{ fontSize: 30, lineHeight: 34, fontFamily: FONTS.serifBold, color: "#fff" }}>
              {category?.name || "Produits"}
            </Text>
            <Text style={{ fontSize: 12, fontFamily: FONTS.body, color: "rgba(255,255,255,0.85)", marginTop: 4 }}>
              {products.length} article{products.length !== 1 ? "s" : ""}
            </Text>
          </View>
        </View>

        {/* Curated "Notre sélection" rail */}
        <SelectionRail products={selection} />

        {/* Product grid */}
        {isLoading ? (
          <View style={{ paddingTop: 40, alignItems: "center" }}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        ) : products.length > 0 ? (
          <>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                paddingHorizontal: 20,
                paddingTop: 20,
                gap: 12,
              }}
            >
              {products.map((product, idx) => (
                <ProductCard key={product.id} product={product} index={idx} />
              ))}
            </View>
            {isFetchingNextPage && (
              <View style={{ paddingVertical: 20, alignItems: "center" }}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            )}
          </>
        ) : (
          <EmptyState
            icon="magnify"
            title="Aucun produit"
            message="Cette catégorie sera bientôt disponible"
            action={{ label: "Retour", onPress: () => router.back() }}
          />
        )}
      </ScrollView>
    </View>
  );
}
