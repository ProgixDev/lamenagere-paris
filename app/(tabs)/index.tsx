import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
  RefreshControl,
  ActivityIndicator,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "../../components/ui/Icon";
import { ProductGridSkeleton } from "../../components/ui/Skeleton";
import * as Haptics from "expo-haptics";
import { COLORS } from "../../lib/constants";
import { FONTS, TYPE, SPACE, SHADOW } from "../../lib/typography";
import { getProductImage } from "../../lib/mock-data";
import { priceTagLabel } from "../../lib/pricing";
import type { Product } from "../../lib/types";
import { useFavoritesStore } from "../../features/favorites/store";
import {
  useFeaturedProducts,
  usePromoBanners,
} from "../../features/featured/store";
import {
  useCategories,
  usePopularProducts,
  useProductsByCategory,
} from "../../features/products/hooks";
import HeroCarousel from "../../components/HeroCarousel";
import SearchBar from "../../components/SearchBar";
import LogoHeader from "../../components/layout/LogoHeader";
import SortFilterSheet from "../../components/home/SortFilterSheet";
import {
  DEFAULT_FILTERS,
  isNonDefault,
  isPriceActive,
  type FilterState,
} from "../../features/products/filter-types";

const { width: W } = Dimensions.get("window");
const H_PAD = 16;
const GUTTER = 14;
const COL_W = (W - H_PAD * 2 - GUTTER) / 2;
// Consistent, curated 4:5 portrait imagery (replaces the chaotic random-height
// "masonry" that read as a discount marketplace).
const IMG_H = Math.round(COL_W * 1.25);

// ─── Top category rail (icon tiles + labels) ──────────────
function TopCategoryTabs({
  active,
  onSelect,
  categories,
}: {
  active: string;
  onSelect: (id: string) => void;
  categories: { id: string; name: string; icon?: string }[];
}) {
  const cats = [{ id: "all", name: "Tout", icon: "view-grid" }, ...categories];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: H_PAD, gap: 14, paddingTop: 6, paddingBottom: 12 }}
    >
      {cats.map((cat) => {
        const isActive = cat.id === active;
        return (
          <TouchableOpacity
            key={cat.id}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(cat.id);
            }}
            activeOpacity={0.85}
            style={{ alignItems: "center", width: 64 }}
          >
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isActive ? COLORS.primary : COLORS.surfaceContainerLowest,
                ...(isActive ? SHADOW.soft : SHADOW.soft),
              }}
            >
              <Icon
                name={cat.icon || "view-grid"}
                size={25}
                color={isActive ? "#fff" : COLORS.primary}
              />
            </View>
            <Text
              numberOfLines={1}
              style={{
                marginTop: 7,
                fontSize: 11,
                fontFamily: isActive ? FONTS.bodySemibold : FONTS.bodyMedium,
                color: isActive ? COLORS.onSurface : COLORS.outline,
                maxWidth: 64,
                textAlign: "center",
              }}
            >
              {cat.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── Product card (premium / boutique) ────────────────────
function ProductCard({ product, index }: { product: Product; index: number }) {
  const router = useRouter();
  const isFav = useFavoritesStore((s) => s.favorites.includes(product.id));
  const toggleFav = useFavoritesStore((s) => s.toggleFavorite);
  const imgSource = getProductImage(product.images[0]);

  const scale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleFav = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleFav(product.id);
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 10) * 60)
        .duration(420)
        .springify()
        .damping(20)}
      style={[{ marginBottom: GUTTER, width: COL_W }, cardStyle]}
    >
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={() => router.push(`/(main)/products/${product.id}`)}
        onPressIn={() => {
          scale.value = withTiming(0.98, { duration: 140 });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 220 });
        }}
        style={{
          width: COL_W,
          backgroundColor: COLORS.surfaceContainerLowest,
          borderRadius: 16,
          overflow: "hidden",
          ...SHADOW.card,
        }}
      >
        {/* Image — consistent 4:5 portrait */}
        <View style={{ width: "100%", height: IMG_H, backgroundColor: COLORS.surfaceContainer }}>
          {imgSource && (
            <Image
              source={imgSource}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          )}
          <TouchableOpacity
            onPress={handleFav}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: "rgba(255,255,255,0.92)",
              alignItems: "center",
              justifyContent: "center",
              ...SHADOW.soft,
            }}
          >
            <Icon
              name={isFav ? "heart" : "heart-outline"}
              size={16}
              color={isFav ? "#C0392B" : COLORS.onSurfaceVariant}
            />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 14 }}>
          <Text
            style={{
              fontSize: 13,
              lineHeight: 18,
              fontFamily: FONTS.bodyMedium,
              color: COLORS.onSurface,
              marginBottom: 6,
            }}
            numberOfLines={2}
          >
            {product.name}
          </Text>

          {product.ratingCount ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 }}>
              <Icon name="star" size={11} color={COLORS.primary} />
              <Text style={{ fontSize: 11, fontFamily: FONTS.bodySemibold, color: COLORS.onSurfaceVariant }}>
                {(product.ratingAvg ?? 0).toFixed(1)}
              </Text>
              <Text style={{ fontSize: 10, fontFamily: FONTS.body, color: COLORS.outline }}>
                ({product.ratingCount})
              </Text>
            </View>
          ) : null}

          <Text style={[TYPE.price, { fontSize: 19 }]}>{priceTagLabel(product)}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Promo banners (admin-curated) ────────────────────────
function PromoBanners() {
  const banners = usePromoBanners();
  if (banners.length === 0) return null;
  return (
    <View style={{ paddingHorizontal: H_PAD, marginBottom: SPACE.xxl, gap: 12 }}>
      {banners.map((b) => (
        <View
          key={b.id}
          style={{
            borderRadius: 20,
            paddingVertical: 22,
            paddingHorizontal: 22,
            backgroundColor: COLORS.primary,
            flexDirection: "row",
            alignItems: "center",
            gap: 16,
            ...SHADOW.card,
          }}
        >
          {b.badge ? (
            <View
              style={{
                backgroundColor: "rgba(255,255,255,0.16)",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontFamily: FONTS.bodySemibold,
                  fontSize: 10,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                {b.badge}
              </Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#fff", fontFamily: FONTS.serif, fontSize: 22, lineHeight: 25 }}>
              {b.title}
            </Text>
            {b.subtitle ? (
              <Text
                style={{
                  color: "rgba(255,255,255,0.82)",
                  fontFamily: FONTS.body,
                  fontSize: 13,
                  marginTop: 3,
                }}
              >
                {b.subtitle}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Featured "Sélection" rail (admin-curated) ────────────
function FeaturedRail({ products }: { products: Product[] }) {
  const router = useRouter();
  if (products.length === 0) return null;
  return (
    <View style={{ marginBottom: SPACE.xxl }}>
      <View style={{ paddingHorizontal: H_PAD, marginBottom: 14 }}>
        <Text style={TYPE.overline}>Curation</Text>
        <Text style={[TYPE.sectionTitle, { marginTop: 2 }]}>Notre sélection</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: H_PAD, gap: 14 }}
      >
        {products.map((product) => {
          const source = getProductImage(product.images[0]);
          return (
            <TouchableOpacity
              key={product.id}
              activeOpacity={0.95}
              onPress={() => router.push(`/(main)/products/${product.id}`)}
              style={{ width: 168 }}
            >
              <View
                style={{
                  width: 168,
                  height: 200,
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
                style={{
                  fontSize: 13,
                  lineHeight: 18,
                  fontFamily: FONTS.bodyMedium,
                  color: COLORS.onSurface,
                  marginTop: 10,
                }}
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

// ─── Two-column product grid (uniform, curated) ───────────
type FeedItem = { key: string; product: Product };

function ProductGrid({ items }: { items: FeedItem[] }) {
  const left: { it: FeedItem; index: number }[] = [];
  const right: { it: FeedItem; index: number }[] = [];
  items.forEach((it, i) => {
    (i % 2 === 0 ? left : right).push({ it, index: i });
  });

  return (
    <View style={{ flexDirection: "row", paddingHorizontal: H_PAD, gap: GUTTER }}>
      <View style={{ flex: 1 }}>
        {left.map(({ it, index }) => (
          <ProductCard key={it.key} product={it.product} index={index} />
        ))}
      </View>
      <View style={{ flex: 1 }}>
        {right.map(({ it, index }) => (
          <ProductCard key={it.key} product={it.product} index={index} />
        ))}
      </View>
    </View>
  );
}

// ─── Home screen ──────────────────────────────────────────
const NEAR_BOTTOM_PX = 600;

export default function HomeScreen() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [refreshing, setRefreshing] = useState(false);
  const featured = useFeaturedProducts();

  const isAll = activeCategory === "all";

  const categoriesQuery = useCategories();
  const popularQuery = usePopularProducts(40);
  const categoryQuery = useProductsByCategory(isAll ? "" : activeCategory);

  // Active product source depends on selected top tab.
  const baseProducts = useMemo<Product[]>(() => {
    if (isAll) return popularQuery.data ?? [];
    return categoryQuery.data?.pages.flatMap((p) => p.items) ?? [];
  }, [isAll, popularQuery.data, categoryQuery.data]);

  const isLoading = isAll
    ? popularQuery.isLoading
    : categoryQuery.isLoading;

  // Price bounds + histogram for the filter sheet, derived from the loaded list.
  const priceBounds = useMemo(() => {
    const prices = baseProducts
      .map((p) => p.price)
      .filter((v): v is number => typeof v === "number" && v > 0);
    if (prices.length === 0) return { min: 0, max: 0 };
    return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) };
  }, [baseProducts]);

  const histogram = useMemo(() => {
    const { min, max } = priceBounds;
    if (max <= min) return undefined;
    const buckets = new Array(32).fill(0);
    baseProducts.forEach((p) => {
      if (typeof p.price !== "number" || p.price <= 0) return;
      const idx = Math.min(31, Math.floor(((p.price - min) / (max - min)) * 32));
      buckets[idx] += 1;
    });
    const peak = Math.max(1, ...buckets);
    return buckets.map((c) => c / peak);
  }, [baseProducts, priceBounds]);

  // Client-side sort + price/rating filter over the loaded list.
  const products = useMemo(() => {
    let list = [...baseProducts];

    if (filters.minRating > 0) {
      list = list.filter((p) => (p.ratingAvg ?? 0) >= filters.minRating);
    }

    if (isPriceActive(filters)) {
      const lo = filters.minPrice > 0 ? filters.minPrice : priceBounds.min;
      const hi = filters.maxPrice > 0 ? filters.maxPrice : priceBounds.max;
      list = list.filter(
        (p) => typeof p.price === "number" && p.price >= lo && p.price <= hi,
      );
    }

    const priceOf = (p: Product) =>
      typeof p.price === "number" ? p.price : Number.POSITIVE_INFINITY;
    if (filters.sort === "recent") {
      list.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    } else if (filters.sort === "price_asc") {
      list.sort((a, b) => priceOf(a) - priceOf(b));
    } else if (filters.sort === "price_desc") {
      list.sort((a, b) => priceOf(b) - priceOf(a));
    }

    return list;
  }, [baseProducts, filters, priceBounds]);

  // Build the grid feed from the real product list.
  const feed = useMemo<FeedItem[]>(() => {
    return products.map((product, i) => ({
      key: `${product.id}-${i}`,
      product,
    }));
  }, [products]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (isAll) {
      await popularQuery.refetch();
    } else {
      await categoryQuery.refetch();
    }
    setRefreshing(false);
  }, [isAll, popularQuery, categoryQuery]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
      if (
        distanceFromBottom < NEAR_BOTTOM_PX &&
        !isAll &&
        categoryQuery.hasNextPage &&
        !categoryQuery.isFetchingNextPage
      ) {
        categoryQuery.fetchNextPage();
      }
    },
    [isAll, categoryQuery],
  );

  const categories = categoriesQuery.data ?? [];

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onScroll={onScroll}
        scrollEventThrottle={64}
      >
        <LogoHeader />
        <SearchBar
          showNotifications
          onFilterPress={() => setSheetOpen(true)}
          filterActive={isNonDefault(filters)}
        />

        <View style={{ backgroundColor: COLORS.background }}>
          <TopCategoryTabs active={activeCategory} onSelect={setActiveCategory} categories={categories} />
        </View>

        <HeroCarousel />

        {isAll && !isNonDefault(filters) && (
          <>
            <PromoBanners />
            <FeaturedRail products={featured} />
          </>
        )}

        {isLoading && feed.length === 0 ? (
          <ProductGridSkeleton count={6} />
        ) : products.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 56, paddingHorizontal: 32 }}>
            <Text style={[TYPE.sectionTitle, { fontSize: 20, textAlign: "center" }]}>
              Aucun produit
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontFamily: FONTS.body,
                color: COLORS.outline,
                textAlign: "center",
                marginTop: 6,
              }}
            >
              Essayez une autre catégorie ou ajustez vos filtres.
            </Text>
          </View>
        ) : (
          <>
            <View style={{ paddingHorizontal: H_PAD, marginBottom: 14 }}>
              <Text style={TYPE.overline}>{isAll ? "Catalogue" : "Sélection"}</Text>
              <Text style={[TYPE.sectionTitle, { marginTop: 2 }]}>
                {isAll
                  ? "Tous nos produits"
                  : categories.find((c) => c.id === activeCategory)?.name ?? "Produits"}
              </Text>
            </View>
            <ProductGrid items={feed} />
            {!isAll && categoryQuery.isFetchingNextPage ? (
              <View style={{ paddingVertical: 24, alignItems: "center" }}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <SortFilterSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        value={filters}
        priceBounds={priceBounds}
        histogram={histogram}
        onApply={setFilters}
      />
    </SafeAreaView>
  );
}
