import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { COLORS } from "../lib/constants";
import { getProductImage } from "../lib/mock-data";
import { priceTagLabel } from "../lib/pricing";
import { usePopularProducts } from "../features/products/hooks";

const { width: W } = Dimensions.get("window");
const HERO_W = W - 48;
const HERO_H = 200;
const AUTO_ADVANCE_MS = 4000;

/**
 * Auto-advancing carousel of featured products. Each slide is tappable and
 * navigates to the product page.
 */
export default function HeroCarousel() {
  const { data: products = [] } = usePopularProducts(8);
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (products.length <= 1) return;
    const t = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % products.length;
        scrollRef.current?.scrollTo({ x: next * HERO_W, animated: true });
        return next;
      });
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(t);
  }, [products.length]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / HERO_W);
    if (i !== index) setIndex(i);
  };

  const openProduct = (id: string) => {
    Haptics.selectionAsync();
    router.push(`/(main)/products/${id}`);
  };

  if (products.length === 0) return null;

  return (
    <View style={{ marginHorizontal: 24, marginBottom: 24 }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        snapToInterval={HERO_W}
        decelerationRate="fast"
        style={{ borderRadius: 16 }}
      >
        {products.map((product) => {
          const source = getProductImage(product.images[0]);
          return (
            <TouchableOpacity
              key={product.id}
              activeOpacity={0.95}
              onPress={() => openProduct(product.id)}
              style={{ width: HERO_W, height: HERO_H }}
            >
              {source ? (
                <Image
                  source={source}
                  style={{ width: HERO_W, height: HERO_H, borderRadius: 16 }}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={{
                    width: HERO_W,
                    height: HERO_H,
                    borderRadius: 16,
                    backgroundColor: COLORS.surfaceContainer,
                  }}
                />
              )}

              <LinearGradient
                colors={["transparent", "rgba(0,36,68,0.7)"]}
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 120,
                  borderBottomLeftRadius: 16,
                  borderBottomRightRadius: 16,
                  justifyContent: "flex-end",
                  padding: 18,
                }}
                pointerEvents="none"
              >
                <Text
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.85)",
                    fontFamily: "Inter_600SemiBold",
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  Sélection
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 20, color: "#fff", fontFamily: "Manrope_700Bold" }}
                >
                  {product.name}
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: "#fff",
                    fontFamily: "Manrope_800ExtraBold",
                    marginTop: 2,
                  }}
                >
                  {priceTagLabel(product)}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {products.length > 1 && (
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10 }}>
          {products.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === index ? 18 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === index ? COLORS.primary : COLORS.outlineVariant,
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}
