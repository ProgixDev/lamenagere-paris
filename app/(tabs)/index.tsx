import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
  useContext,
  createContext,
} from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  type SharedValue,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "../../components/ui/Icon";
import { ProductGridSkeleton } from "../../components/ui/Skeleton";
import * as Haptics from "expo-haptics";
import AppHeader from "../../components/layout/AppHeader";
import { COLORS, BRAND } from "../../lib/constants";
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
import SortFilterSheet from "../../components/home/SortFilterSheet";
import {
  DEFAULT_FILTERS,
  isNonDefault,
  isPriceActive,
  type FilterState,
} from "../../features/products/filter-types";
import { productCoverSource, productCoverUri } from "../../lib/product-media";

const { width: W } = Dimensions.get("window");
const H_PAD = 16;
const GUTTER = 14;
const COL_W = (W - H_PAD * 2 - GUTTER) / 2;
// Consistent, curated 4:5 portrait imagery (replaces the chaotic random-height
// "masonry" that read as a discount marketplace).
const IMG_H = Math.round(COL_W * 1.25);
// Cards are fixed-height by design (image + 36px title + 26px price row and
// fixed padding), so we can hand the list an exact row height and let it skip
// measurement entirely.
const CARD_BODY_H = 88;
const ROW_H = IMG_H + CARD_BODY_H + GUTTER;

// The grid reveals itself in slices as the customer scrolls instead of
// mounting the whole response at once.
const FIRST_SLICE = 8;
const SLICE = 8;
// Minimum gap between two "load more" reactions, so a fast fling can't burn
// through the whole list in a single frame.
const END_REACHED_COOLDOWN_MS = 350;

/**
 * Category-switch crossfade, shared with the virtualized cells.
 *
 * The transition used to live on a single `Animated.View` wrapping the feed —
 * impossible now that the cards are list items. Passing the shared value down
 * costs one worklet read per visible card and keeps the animation identical.
 */
const FeedFade = createContext<SharedValue<number> | null>(null);

// ─── Top category rail (icon tiles + labels) ──────────────
const CAT_ITEM_W = 80;

type Cat = { id: string; name: string; icon?: string; image?: string };

const TopCategoryTabs = React.memo(function TopCategoryTabs({
  active,
  onSelect,
  categories,
}: {
  active: string;
  onSelect: (id: string) => void;
  categories: Cat[];
}) {
  const cats = useMemo<Cat[]>(
    () => [{ id: "all", name: "Tout", icon: "view-grid" }, ...categories],
    [categories],
  );

  const renderItem = useCallback(
    ({ item }: { item: Cat }) => (
      <CategoryCircle
        cat={item}
        isActive={item.id === active}
        onPress={() => {
          Haptics.selectionAsync();
          onSelect(item.id);
        }}
      />
    ),
    [active, onSelect],
  );

  return (
    <FlatList
      horizontal
      data={cats}
      keyExtractor={(c) => c.id}
      renderItem={renderItem}
      extraData={active}
      showsHorizontalScrollIndicator={false}
      initialNumToRender={6}
      maxToRenderPerBatch={4}
      windowSize={3}
      getItemLayout={(_, index) => ({
        length: CAT_ITEM_W + 14,
        offset: (CAT_ITEM_W + 14) * index,
        index,
      })}
      contentContainerStyle={{
        paddingHorizontal: H_PAD,
        gap: 14,
        paddingTop: 8,
        paddingBottom: 14,
      }}
    />
  );
});

const CategoryCircle = React.memo(function CategoryCircle({
  cat,
  isActive,
  onPress,
}: {
  cat: Cat;
  isActive: boolean;
  onPress: () => void;
}) {
  const imgSource = cat.image ? getProductImage(cat.image) : undefined;

  // Tactile press-scale, plus a soft "lift" of the active ring.
  const press = useSharedValue(1);
  const active = useSharedValue(isActive ? 1 : 0);
  useEffect(() => {
    active.value = withTiming(isActive ? 1 : 0, { duration: 260 });
  }, [isActive, active]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value * (1 + active.value * 0.04) }],
    borderWidth: 1 + active.value,
  }));

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      onPressIn={() => {
        press.value = withTiming(0.92, { duration: 120 });
      }}
      onPressOut={() => {
        press.value = withTiming(1, { duration: 220 });
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={cat.name}
      style={{ alignItems: "center", width: CAT_ITEM_W }}
    >
      {/* Photo circle with a navy "story ring" when active */}
      <Animated.View
        style={[
          {
            width: 68,
            height: 68,
            borderRadius: 34,
            padding: 3,
            alignItems: "center",
            justifyContent: "center",
            borderColor: isActive ? COLORS.primary : COLORS.outlineVariant,
            backgroundColor: COLORS.background,
          },
          ringStyle,
        ]}
      >
        <View
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 30,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: COLORS.surfaceContainerLow,
          }}
        >
          {imgSource ? (
            <Image
              source={imgSource}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={cat.id}
              transition={150}
            />
          ) : (
            <Icon name={cat.icon || "view-grid"} size={24} color={COLORS.primary} />
          )}
        </View>
      </Animated.View>

      {/* Fixed-height label area shows the full title over up to two lines,
          so circles stay aligned whether a name wraps or not. */}
      <View style={{ height: 30, marginTop: 8, justifyContent: "flex-start", width: CAT_ITEM_W }}>
        <Text
          numberOfLines={2}
          style={{
            fontSize: 11,
            lineHeight: 14,
            fontFamily: isActive ? FONTS.bodySemibold : FONTS.bodyMedium,
            color: isActive ? COLORS.onSurface : COLORS.outline,
            textAlign: "center",
          }}
        >
          {cat.name}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

// ─── Product card (premium / boutique) ────────────────────
const ProductCard = React.memo(function ProductCard({ product }: { product: Product }) {
  const router = useRouter();
  const isFav = useFavoritesStore((s) => s.favorites.includes(product.id));
  const toggleFav = useFavoritesStore((s) => s.toggleFavorite);
  const imgSource = productCoverSource(product);
  const fade = useContext(FeedFade);

  const scale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => {
    const f = fade ? fade.value : 1;
    return {
      opacity: f,
      transform: [{ scale: scale.value }, { translateY: (1 - f) * 14 }],
    };
  });

  const handleFav = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleFav(product.id);
  };

  return (
    <Animated.View style={[{ marginBottom: GUTTER, width: COL_W }, cardStyle]}>
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
          borderRadius: 10,
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
              contentFit="cover"
              cachePolicy="memory-disk"
              // Tells expo-image the view was recycled onto another product so
              // it clears the previous bitmap instead of flashing it.
              recyclingKey={product.id}
              transition={200}
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

        {/* Content — fixed heights so the price lines up across a row. */}
        <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 }}>
          <Text
            style={{
              fontSize: 13,
              lineHeight: 18,
              height: 36,
              fontFamily: FONTS.bodyMedium,
              color: COLORS.onSurface,
            }}
            numberOfLines={2}
          >
            {product.name}
          </Text>

          {/* Rating and price share a row: the price is right-aligned and never
              shrinks, so a long rating truncates before the price does. */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, minHeight: 26, marginTop: 4 }}>
            {product.ratingCount ? (
              <>
                <Icon name="star" size={11} color={BRAND.yellow} />
                <Text style={{ fontSize: 11, fontFamily: FONTS.bodySemibold, color: COLORS.onSurfaceVariant }}>
                  {(product.ratingAvg ?? 0).toFixed(1)}
                </Text>
                <Text
                  style={{ fontSize: 10, fontFamily: FONTS.body, color: COLORS.outline, flexShrink: 1 }}
                  numberOfLines={1}
                >
                  ({product.ratingCount})
                </Text>
              </>
            ) : null}

            <View style={{ flex: 1 }} />

            <Text
              style={[TYPE.price, { fontSize: 18, color: COLORS.primary, flexShrink: 0 }]}
              numberOfLines={1}
            >
              {priceTagLabel(product)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── Promo banners (admin-curated) ────────────────────────
const PromoBanners = React.memo(function PromoBanners() {
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
});

// ─── Featured "Sélection" rail (admin-curated) ────────────
const RAIL_CARD_W = 168;

const FeaturedCard = React.memo(function FeaturedCard({ product }: { product: Product }) {
  const router = useRouter();
  const source = productCoverSource(product);
  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={() => router.push(`/(main)/products/${product.id}`)}
      style={{
        width: RAIL_CARD_W,
        backgroundColor: COLORS.surfaceContainerLowest,
        borderRadius: 10,
        overflow: "hidden",
        ...SHADOW.card,
      }}
    >
      <View style={{ width: "100%", height: 200, backgroundColor: COLORS.surfaceContainer }}>
        {source && (
          <Image
            source={source}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={product.id}
            transition={200}
          />
        )}
      </View>
      <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 }}>
        <Text
          numberOfLines={2}
          style={{
            fontSize: 13,
            lineHeight: 18,
            height: 36,
            fontFamily: FONTS.bodyMedium,
            color: COLORS.onSurface,
          }}
        >
          {product.name}
        </Text>

        {/* Price — navy text, no filled bar. */}
        <Text
          style={[TYPE.price, { fontSize: 17, color: COLORS.primary, textAlign: "right", marginTop: 6 }]}
          numberOfLines={1}
        >
          {priceTagLabel(product)}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

const FeaturedRail = React.memo(function FeaturedRail({ products }: { products: Product[] }) {
  if (products.length === 0) return null;
  return (
    <View style={{ marginBottom: SPACE.xxl }}>
      <View style={{ paddingHorizontal: H_PAD, marginBottom: 14 }}>
        <Text style={TYPE.overline}>Curation</Text>
        <Text style={[TYPE.sectionTitle, { marginTop: 2 }]}>Notre sélection</Text>
      </View>
      <FlatList
        horizontal
        data={products}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <FeaturedCard product={item} />}
        showsHorizontalScrollIndicator={false}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={3}
        getItemLayout={(_, index) => ({
          length: RAIL_CARD_W + 14,
          offset: (RAIL_CARD_W + 14) * index,
          index,
        })}
        contentContainerStyle={{
          paddingHorizontal: H_PAD,
          gap: 14,
          paddingTop: 2,
          paddingBottom: 12,
        }}
      />
    </View>
  );
});

// ─── Scrollable header above the grid ─────────────────────
const HomeHeader = React.memo(function HomeHeader({
  activeCategory,
  categories,
  onSelectCategory,
  onFilterPress,
  filterActive,
  showCurated,
  featured,
  sectionOverline,
  sectionTitle,
  showSection,
}: {
  activeCategory: string;
  categories: Cat[];
  onSelectCategory: (id: string) => void;
  onFilterPress: () => void;
  filterActive: boolean;
  showCurated: boolean;
  featured: Product[];
  sectionOverline: string;
  sectionTitle: string;
  showSection: boolean;
}) {
  return (
    <View>
      <AppHeader greeting onFilterPress={onFilterPress} filterActive={filterActive} />

      <View style={{ backgroundColor: COLORS.background }}>
        <TopCategoryTabs
          active={activeCategory}
          onSelect={onSelectCategory}
          categories={categories}
        />
      </View>

      <HeroCarousel />

      {showCurated && (
        <>
          <PromoBanners />
          <FeaturedRail products={featured} />
        </>
      )}

      {showSection && (
        <View style={{ paddingHorizontal: H_PAD, marginBottom: 14 }}>
          <Text style={TYPE.overline}>{sectionOverline}</Text>
          <Text style={[TYPE.sectionTitle, { marginTop: 2 }]}>{sectionTitle}</Text>
        </View>
      )}
    </View>
  );
});

// ─── Home screen ──────────────────────────────────────────
export default function HomeScreen() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [refreshing, setRefreshing] = useState(false);
  // How much of the loaded list is actually mounted; grows as the customer
  // reaches the bottom.
  const [visibleCount, setVisibleCount] = useState(FIRST_SLICE);
  const featured = useFeaturedProducts();

  const isAll = activeCategory === "all";

  const categoriesQuery = useCategories();
  const popularQuery = usePopularProducts(40);
  const categoryQuery = useProductsByCategory(isAll ? "" : activeCategory);

  // Active product source depends on selected top tab.
  const baseProducts = useMemo<Product[]>(() => {
    const list = isAll
      ? popularQuery.data ?? []
      : categoryQuery.data?.pages.flatMap((p) => p.items) ?? [];
    // The list is keyed by product id now (no index suffix), so an id repeated
    // across two fetched pages would collide.
    const seen = new Set<string>();
    return list.filter((p) => !seen.has(p.id) && seen.add(p.id));
  }, [isAll, popularQuery.data, categoryQuery.data]);

  const isLoading = isAll ? popularQuery.isLoading : categoryQuery.isLoading;

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

  // Anything that changes what the grid shows restarts the reveal window.
  useEffect(() => {
    setVisibleCount(FIRST_SLICE);
  }, [activeCategory, filters]);

  // Only this slice is handed to the list; the list then windows it further.
  const feed = useMemo(
    () => products.slice(0, visibleCount),
    [products, visibleCount],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setVisibleCount(FIRST_SLICE);
    try {
      if (isAll) await popularQuery.refetch();
      else await categoryQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [isAll, popularQuery, categoryQuery]);

  // Reaching the bottom first reveals more of what's already in memory, and
  // only asks the server for another page once the local list is exhausted.
  const lastEndReachedRef = useRef(0);
  const onEndReached = useCallback(() => {
    const now = Date.now();
    if (now - lastEndReachedRef.current < END_REACHED_COOLDOWN_MS) return;
    lastEndReachedRef.current = now;

    if (visibleCount < products.length) {
      setVisibleCount((c) => Math.min(c + SLICE, products.length));
      return;
    }
    if (!isAll && categoryQuery.hasNextPage && !categoryQuery.isFetchingNextPage) {
      categoryQuery.fetchNextPage();
    }
  }, [visibleCount, products.length, isAll, categoryQuery]);

  // Premium category rail uses real photography. Prefer the admin's category
  // image; otherwise borrow the first product image of that category as a cover
  // so the circles never fall back to a bare icon when products exist.
  const categoryCovers = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of popularQuery.data ?? []) {
      const cid = p.category?.id;
      const img = productCoverUri(p);
      if (cid && img && !map[cid]) map[cid] = img;
    }
    return map;
  }, [popularQuery.data]);

  const categories = useMemo(
    () =>
      (categoriesQuery.data ?? []).map((c) => ({
        ...c,
        image: c.image ?? categoryCovers[c.id],
      })),
    [categoriesQuery.data, categoryCovers],
  );

  // Graceful content transition: the whole feed crossfades and settles upward
  // each time the customer switches category, so the swap feels intentional
  // rather than a hard cut.
  const contentAnim = useSharedValue(0);
  useEffect(() => {
    contentAnim.value = 0;
    contentAnim.value = withTiming(1, {
      duration: 420,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeCategory, contentAnim]);

  const openSheet = useCallback(() => setSheetOpen(true), []);
  const filtersActive = isNonDefault(filters);

  const renderItem = useCallback(
    ({ item }: { item: Product }) => <ProductCard product={item} />,
    [],
  );

  const header = (
    <HomeHeader
      activeCategory={activeCategory}
      categories={categories}
      onSelectCategory={setActiveCategory}
      onFilterPress={openSheet}
      filterActive={filtersActive}
      showCurated={isAll && !filtersActive}
      featured={featured}
      sectionOverline={isAll ? "Catalogue" : "Sélection"}
      sectionTitle={
        isAll
          ? "Tous nos produits"
          : categories.find((c) => c.id === activeCategory)?.name ?? "Produits"
      }
      showSection={products.length > 0}
    />
  );

  const empty =
    isLoading && products.length === 0 ? (
      <ProductGridSkeleton count={6} />
    ) : (
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
    );

  const footer =
    visibleCount < products.length ||
    (!isAll && categoryQuery.isFetchingNextPage) ? (
      <View style={{ paddingVertical: 24, alignItems: "center" }}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    ) : null;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: COLORS.background }}>
      <FeedFade.Provider value={contentAnim}>
        <FlatList
          data={feed}
          renderItem={renderItem}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: H_PAD, gap: GUTTER }}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          ListFooterComponent={footer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.6}
          // Rows are a known fixed height, so the list can position everything
          // without measuring a single cell.
          getItemLayout={(_, index) => ({
            length: ROW_H,
            offset: ROW_H * index,
            index,
          })}
          initialNumToRender={FIRST_SLICE / 2}
          maxToRenderPerBatch={4}
          updateCellsBatchingPeriod={60}
          windowSize={5}
          removeClippedSubviews
        />
      </FeedFade.Provider>

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
