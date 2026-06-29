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
import * as Haptics from "expo-haptics";
import { COLORS } from "../../lib/constants";
import { getProductImage } from "../../lib/mock-data";
import { priceTagLabel } from "../../lib/pricing";
import type { Product } from "../../lib/types";
import { useFavoritesStore } from "../../features/favorites/store";
import { useCartStore } from "../../features/cart/store";
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
const GUTTER = 8;
const COL_W = (W - 12 * 2 - GUTTER) / 2;

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
      contentContainerStyle={{ paddingHorizontal: 14, gap: 12, paddingTop: 6, paddingBottom: 10 }}
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
            style={{ alignItems: "center", width: 66 }}
          >
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isActive ? COLORS.primary : COLORS.surfaceContainerLowest,
                borderWidth: 1,
                borderColor: isActive ? COLORS.primary : COLORS.outlineVariant,
              }}
            >
              <Icon
                name={cat.icon || "view-grid"}
                size={26}
                color={isActive ? "#fff" : COLORS.primary}
              />
            </View>
            <Text
              numberOfLines={1}
              style={{
                marginTop: 6,
                fontSize: 11,
                fontFamily: isActive ? "Manrope_700Bold" : "Inter_500Medium",
                color: isActive ? COLORS.onSurface : COLORS.outline,
                maxWidth: 66,
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

// ─── Product card (Temu-style) ────────────────────────────
function ProductCardTemu({
  product,
  imgHeight,
  index,
}: {
  product: Product;
  imgHeight: number;
  index: number;
}) {
  const router = useRouter();
  const isFav = useFavoritesStore((s) => s.favorites.includes(product.id));
  const toggleFav = useFavoritesStore((s) => s.toggleFavorite);
  const addItem = useCartStore((s) => s.addItem);
  const imgSource = getProductImage(product.images[0]);

  const scale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleFav = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleFav(product.id);
  };

  // Per-m² products need dimensions before they can be priced/ordered, so the
  // quick-add button sends the customer to the product page instead.
  const needsDimensions =
    product.priceMode === "per_sqm" || product.productType === "configurable";

  const handleAdd = async () => {
    if (needsDimensions) {
      router.push(`/(main)/products/${product.id}`);
      return;
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addItem(product, 1);
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 12) * 45)
        .springify()
        .damping(18)}
      style={[{ marginBottom: GUTTER }, cardStyle]}
    >
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={() => router.push(`/(main)/products/${product.id}`)}
      onPressIn={() => {
        scale.value = withTiming(0.97, { duration: 90 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 150 });
      }}
      style={{
        width: COL_W,
        backgroundColor: "#fff",
        borderRadius: 8,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: COLORS.outlineVariant + "44",
      }}
    >
      {/* Image */}
      <View style={{ width: "100%", height: imgHeight, backgroundColor: COLORS.surfaceContainer }}>
        {imgSource && (
          <Image
            source={imgSource}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        )}
        <TouchableOpacity
          onPress={handleFav}
          hitSlop={8}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: "rgba(255,255,255,0.85)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon
            name={isFav ? "heart" : "heart-outline"}
            size={14}
            color={isFav ? "#E74040" : COLORS.onSurface}
          />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={{ padding: 8 }}>
        <Text
          style={{
            fontSize: 12,
            fontFamily: "Inter_500Medium",
            color: COLORS.onSurface,
            marginBottom: 4,
          }}
          numberOfLines={2}
        >
          {product.name}
        </Text>

        {product.ratingCount ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 4 }}>
            <Icon name="star" size={11} color={COLORS.secondary} />
            <Text style={{ fontSize: 11, fontFamily: "Manrope_700Bold", color: COLORS.onSurface }}>
              {(product.ratingAvg ?? 0).toFixed(1)}
            </Text>
            <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: COLORS.outline }}>
              ({product.ratingCount})
            </Text>
          </View>
        ) : null}

        {/* Price + add */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text
              style={{
                fontSize: 17,
                fontFamily: "Manrope_800ExtraBold",
                color: COLORS.secondary,
              }}
            >
              {priceTagLabel(product)}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleAdd}
            hitSlop={6}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: COLORS.outline,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#fff",
            }}
          >
            <Icon
              name={needsDimensions ? "ruler-square" : "cart-plus"}
              size={16}
              color={COLORS.onSurface}
            />
          </TouchableOpacity>
        </View>
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
    <View style={{ paddingHorizontal: 24, marginBottom: 24, gap: 10 }}>
      {banners.map((b) => (
        <View
          key={b.id}
          style={{
            borderRadius: 16,
            padding: 18,
            backgroundColor: COLORS.primary,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
          }}
        >
          {b.badge ? (
            <View
              style={{
                backgroundColor: "rgba(255,255,255,0.18)",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
              }}
            >
              <Text style={{ color: "#fff", fontFamily: "Manrope_700Bold", fontSize: 11 }}>
                {b.badge}
              </Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#fff", fontFamily: "Manrope_700Bold", fontSize: 16 }}>
              {b.title}
            </Text>
            {b.subtitle ? (
              <Text
                style={{
                  color: "rgba(255,255,255,0.85)",
                  fontFamily: "Inter_400Regular",
                  fontSize: 12,
                  marginTop: 2,
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
    <View style={{ marginBottom: 24 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 24,
          marginBottom: 12,
        }}
      >
        <Icon name="star" size={16} color={COLORS.primary} />
        <Text style={{ fontFamily: "Manrope_700Bold", fontSize: 18, color: COLORS.onSurface }}>
          Notre sélection
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}
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
                  height: 150,
                  borderRadius: 8,
                  overflow: "hidden",
                  backgroundColor: COLORS.surfaceContainer,
                }}
              >
                {source && (
                  <Image source={source} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                )}
              </View>
              <Text
                numberOfLines={2}
                style={{
                  fontSize: 12,
                  fontFamily: "Inter_500Medium",
                  color: COLORS.onSurface,
                  marginTop: 6,
                }}
              >
                {product.name}
              </Text>
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: "Manrope_800ExtraBold",
                  color: COLORS.secondary,
                  marginTop: 2,
                }}
              >
                {priceTagLabel(product)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Two-column masonry feed ──────────────────────────────
type FeedItem = { key: string; product: Product; imgHeight: number };

function MasonryFeed({ items }: { items: FeedItem[] }) {
  const left: { it: FeedItem; index: number }[] = [];
  const right: { it: FeedItem; index: number }[] = [];
  items.forEach((it, i) => {
    (i % 2 === 0 ? left : right).push({ it, index: i });
  });

  return (
    <View style={{ flexDirection: "row", paddingHorizontal: 12, gap: GUTTER }}>
      <View style={{ flex: 1 }}>
        {left.map(({ it, index }) => (
          <ProductCardTemu key={it.key} product={it.product} imgHeight={it.imgHeight} index={index} />
        ))}
      </View>
      <View style={{ flex: 1 }}>
        {right.map(({ it, index }) => (
          <ProductCardTemu key={it.key} product={it.product} imgHeight={it.imgHeight + 30} index={index} />
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

  // Build the masonry feed from the real product list.
  const feed = useMemo<FeedItem[]>(() => {
    return products.map((product, i) => {
      const variance = (product.id.charCodeAt(product.id.length - 1) % 5) * 18;
      return {
        key: `${product.id}-${i}`,
        product,
        imgHeight: 160 + variance,
      };
    });
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
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <LogoHeader />
      <SearchBar
        showNotifications
        onFilterPress={() => setSheetOpen(true)}
        filterActive={isNonDefault(filters)}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        stickyHeaderIndices={[0]}
        onScroll={onScroll}
        scrollEventThrottle={64}
      >
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

        <MasonryFeed items={feed} />

        {isLoading ? (
          <View style={{ paddingVertical: 20, alignItems: "center" }}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        ) : products.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 40 }}>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: COLORS.outline }}>
              Aucun produit trouvé.
            </Text>
          </View>
        ) : (!isAll && categoryQuery.isFetchingNextPage) ? (
          <View style={{ paddingVertical: 20, alignItems: "center" }}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        ) : null}
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
