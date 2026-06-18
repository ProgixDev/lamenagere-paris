import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import Icon from "../../components/ui/Icon";
import PressableScale from "../../components/ui/PressableScale";
import { COLORS } from "../../lib/constants";
import {
  PRODUCT_IMAGES,
  getProductImage,
} from "../../lib/mock-data";
import { useFeaturedProducts } from "../../features/featured/store";
import {
  useCategories,
  usePopularProducts,
} from "../../features/products/hooks";
import { priceTagLabel } from "../../lib/pricing";
import type { Product, Category } from "../../lib/types";
import SearchBar from "../../components/SearchBar";
import PromoBanner from "../../components/PromoBanner";
import LogoHeader from "../../components/layout/LogoHeader";

const { width: W } = Dimensions.get("window");
const PAGE_PAD = 16;
const GRID_GAP = 12;
const COL_W = (W - PAGE_PAD * 2 - GRID_GAP) / 2;

const CATEGORY_COVERS: Record<string, any> = {
  "1": PRODUCT_IMAGES.portePivotante,
  "2": PRODUCT_IMAGES.cuisineLuxeIlot,
  "3": PRODUCT_IMAGES.canapeModulable,
  "4": PRODUCT_IMAGES.chambreRoyale,
  "5": PRODUCT_IMAGES.baieCoulissante,
  "6": PRODUCT_IMAGES.buffetMiroir,
};

const CATEGORY_TAGLINES: Record<string, string> = {
  "1": "Sécurité et caractère",
  "2": "Cœur de la maison",
  "3": "Confort à vivre",
  "4": "Repos d'exception",
  "5": "Lumière et ouverture",
  "6": "Détails qui font la pièce",
};

const HERO_CATEGORY_ID = "2"; // Cuisines

export default function CategoriesScreen() {
  const router = useRouter();
  const featured = useFeaturedProducts();
  const { data: categories = [] } = useCategories();
  const { data: popular = [] } = usePopularProducts(6);
  const heroCat = categories.find((c) => c.id === HERO_CATEGORY_ID) ?? categories[0];
  const otherCats = heroCat
    ? categories.filter((c) => c.id !== heroCat.id)
    : categories;
  const heroProducts = featured.length > 0 ? featured : popular;

  const productCount = (cat: Category | undefined) => cat?.productCount ?? 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <LogoHeader />
      <SearchBar placeholder="Rechercher une collection..." />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <PromoBanner />

        {/* ── Editorial hero ───────────────────────── */}
        <View style={{ paddingHorizontal: PAGE_PAD, marginTop: 8, marginBottom: 6 }}>
          <Text
            style={{
              fontSize: 10,
              fontFamily: "Inter_600SemiBold",
              color: COLORS.outline,
              letterSpacing: 2.5,
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            Collection 2026
          </Text>
          <Text
            style={{
              fontSize: 24,
              fontFamily: "Manrope_800ExtraBold",
              color: COLORS.onSurface,
            }}
          >
            Nos collections
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontFamily: "Inter_400Regular",
              color: COLORS.onSurfaceVariant,
              marginTop: 4,
            }}
          >
            L'art du sur-mesure, livré chez vous.
          </Text>
        </View>

        {/* ── Hero card (full-width) ───────────────── */}
        {heroCat && (
          <TouchableOpacity
            activeOpacity={0.94}
            onPress={() => router.push(`/(main)/categories/${heroCat.id}`)}
            style={{
              marginHorizontal: PAGE_PAD,
              marginTop: 16,
              borderRadius: 18,
              overflow: "hidden",
              backgroundColor: COLORS.primary,
            }}
          >
            <Image
              source={CATEGORY_COVERS[heroCat.id]}
              style={{ width: "100%", height: 260 }}
              resizeMode="cover"
            />
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.15)", "rgba(0,36,68,0.92)"]}
              locations={[0, 0.5, 1]}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: 200,
                padding: 18,
                justifyContent: "flex-end",
              }}
            >
              <View
                style={{
                  alignSelf: "flex-start",
                  backgroundColor: "rgba(255,255,255,0.18)",
                  borderRadius: 9999,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontFamily: "Inter_700Bold",
                    color: "#fff",
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                  }}
                >
                  À la une
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 28,
                  fontFamily: "Manrope_800ExtraBold",
                  color: "#fff",
                }}
              >
                {heroCat.name}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: "Inter_400Regular",
                  color: "rgba(255,255,255,0.85)",
                  marginTop: 4,
                }}
              >
                {productCount(heroCat)} créations · {CATEGORY_TAGLINES[heroCat.id] ?? ""}
              </Text>
              <View
                style={{
                  alignSelf: "flex-start",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 9999,
                  backgroundColor: "#fff",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: "Inter_700Bold",
                    color: COLORS.primary,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  Découvrir
                </Text>
                <Icon name="arrow-right" size={14} color={COLORS.primary} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* ── Section header ───────────────────────── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
            paddingHorizontal: PAGE_PAD,
            marginTop: 28,
            marginBottom: 14,
          }}
        >
          <View>
            <Text
              style={{
                fontSize: 10,
                fontFamily: "Inter_600SemiBold",
                color: COLORS.outline,
                letterSpacing: 2.5,
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              Explorer
            </Text>
            <Text
              style={{
                fontSize: 18,
                fontFamily: "Manrope_700Bold",
                color: COLORS.onSurface,
              }}
            >
              Toutes les catégories
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/(main)/search")}>
            <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: COLORS.secondary }}>
              Tout voir →
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Bento grid 2-col ─────────────────────── */}
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            paddingHorizontal: PAGE_PAD,
            gap: GRID_GAP,
          }}
        >
          {otherCats.map((cat, idx) => (
            <CategoryBentoCard
              key={cat.id}
              category={cat}
              tall={idx % 3 === 0}
              count={productCount(cat)}
              index={idx}
              onPress={() => router.push(`/(main)/categories/${cat.id}`)}
            />
          ))}
        </View>

        {/* ── Editorial picks (horizontal) ─────────── */}
        <View style={{ marginTop: 28 }}>
          <View style={{ paddingHorizontal: PAGE_PAD, marginBottom: 14 }}>
            <Text
              style={{
                fontSize: 10,
                fontFamily: "Inter_600SemiBold",
                color: COLORS.outline,
                letterSpacing: 2.5,
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              Sélection
            </Text>
            <Text
              style={{
                fontSize: 18,
                fontFamily: "Manrope_700Bold",
                color: COLORS.onSurface,
              }}
            >
              Coups de cœur de l'équipe
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: PAGE_PAD, gap: 12 }}
          >
            {heroProducts.map((p) => (
              <EditorialCard
                key={p.id}
                product={p}
                onPress={() => router.push(`/(main)/products/${p.id}`)}
              />
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CategoryBentoCard({
  category,
  tall,
  count,
  index,
  onPress,
}: {
  category: Category;
  tall: boolean;
  count: number;
  index: number;
  onPress: () => void;
}) {
  const cover = CATEGORY_COVERS[category.id];
  const tagline = CATEGORY_TAGLINES[category.id] ?? "";
  const height = tall ? COL_W * 1.4 : COL_W * 1.1;
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 60).springify().damping(18)}>
    <PressableScale
      onPress={onPress}
      style={{
        width: COL_W,
        height,
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor: COLORS.surfaceContainer,
      }}
    >
      {cover && (
        <Image
          source={cover}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
        />
      )}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.05)", "rgba(0,0,0,0.75)"]}
        locations={[0, 0.45, 1]}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "70%",
          padding: 12,
          justifyContent: "flex-end",
        }}
      >
        <Text
          style={{
            fontSize: 9,
            fontFamily: "Inter_600SemiBold",
            color: "rgba(255,255,255,0.75)",
            textTransform: "uppercase",
            letterSpacing: 1.5,
            marginBottom: 2,
          }}
          numberOfLines={1}
        >
          {tagline}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text
            style={{
              flex: 1,
              fontSize: 16,
              fontFamily: "Manrope_700Bold",
              color: "#fff",
            }}
            numberOfLines={1}
          >
            {category.name}
          </Text>
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: "rgba(255,255,255,0.22)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="arrow-right" size={12} color="#fff" />
          </View>
        </View>
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Inter_500Medium",
            color: "rgba(255,255,255,0.7)",
            marginTop: 2,
          }}
        >
          {count} article{count > 1 ? "s" : ""}
        </Text>
      </LinearGradient>
    </PressableScale>
    </Animated.View>
  );
}

function EditorialCard({ product, onPress }: { product: Product; onPress: () => void }) {
  const img = getProductImage(product.images[0]);
  return (
    <PressableScale onPress={onPress} style={{ width: 168 }}>
      <View
        style={{
          width: 168,
          height: 200,
          borderRadius: 14,
          overflow: "hidden",
          backgroundColor: COLORS.surfaceContainer,
          marginBottom: 8,
        }}
      >
        {img && <Image source={img} style={{ width: "100%", height: "100%" }} resizeMode="cover" />}
      </View>
      <Text
        style={{
          fontSize: 12,
          fontFamily: "Inter_500Medium",
          color: COLORS.onSurface,
          marginBottom: 2,
        }}
        numberOfLines={1}
      >
        {product.name}
      </Text>
      <Text
        style={{
          fontSize: 14,
          fontFamily: "Manrope_800ExtraBold",
          color: COLORS.secondary,
        }}
      >
        {priceTagLabel(product)}
      </Text>
    </PressableScale>
  );
}
