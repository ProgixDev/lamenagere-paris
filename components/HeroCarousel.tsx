import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { useHeroSlides, type HeroSlide } from "../features/featured/store";
import { FONTS } from "../lib/typography";

const { width: W } = Dimensions.get("window");
const HERO_W = W; // paging width (full screen); the card itself is inset
const HERO_MARGIN = 16;
const CARD_W = W - HERO_MARGIN * 2;
const HERO_H = 240;
const AUTO_ADVANCE_MS = 4500;

/**
 * Auto-advancing hero carousel driven by the admin's curated slides
 * (GET /home). When no slides are configured, it falls back to the most
 * popular products so the home is never empty. Each slide is tappable.
 */
export default function HeroCarousel() {
  const adminSlides = useHeroSlides();
  const { data: popular = [] } = usePopularProducts(8);
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  // Prefer the admin's slides; otherwise synthesize slides from popular products.
  const slides = useMemo<HeroSlide[]>(() => {
    if (adminSlides.length > 0) return adminSlides;
    return popular.map((p) => ({
      id: p.id,
      kind: "image" as const,
      src: p.images[0] ?? "",
      title: p.name,
      subtitle: priceTagLabel(p),
      productId: p.id,
    }));
  }, [adminSlides, popular]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % slides.length;
        scrollRef.current?.scrollTo({ x: next * HERO_W, animated: true });
        return next;
      });
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(t);
  }, [slides.length]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / HERO_W);
    if (i !== index) setIndex(i);
  };

  const openSlide = (slide: HeroSlide) => {
    if (!slide.productId && !slide.categoryId) return;
    Haptics.selectionAsync();
    if (slide.productId) router.push(`/(main)/products/${slide.productId}`);
    else if (slide.categoryId) router.push(`/(main)/categories/${slide.categoryId}`);
  };

  if (slides.length === 0) return null;

  return (
    <View style={{ marginBottom: 24 }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        snapToInterval={HERO_W}
        decelerationRate="fast"
      >
        {slides.map((slide) => {
          const source = getProductImage(slide.src);
          return (
            <View key={slide.id} style={{ width: HERO_W, height: HERO_H, paddingHorizontal: HERO_MARGIN }}>
              <TouchableOpacity
                activeOpacity={0.95}
                onPress={() => openSlide(slide)}
                style={{
                  width: CARD_W,
                  height: HERO_H,
                  borderRadius: 22,
                  overflow: "hidden",
                  backgroundColor: COLORS.surfaceContainer,
                }}
              >
                {source ? (
                  <Image
                    source={source}
                    style={{ width: CARD_W, height: HERO_H }}
                    resizeMode="cover"
                  />
                ) : null}

                <LinearGradient
                  colors={["transparent", "rgba(0,36,68,0.78)"]}
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 140,
                    justifyContent: "flex-end",
                    padding: 20,
                  }}
                  pointerEvents="none"
                >
                  {slide.subtitle ? (
                    <Text
                      style={{
                        fontSize: 10,
                        color: "rgba(255,255,255,0.85)",
                        fontFamily: FONTS.bodySemibold,
                        letterSpacing: 2,
                        textTransform: "uppercase",
                        marginBottom: 6,
                      }}
                    >
                      {slide.subtitle}
                    </Text>
                  ) : null}
                  <Text
                    numberOfLines={2}
                    style={{ fontSize: 26, lineHeight: 28, color: "#fff", fontFamily: FONTS.serifBold }}
                  >
                    {slide.title}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      {slides.length > 1 && (
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10 }}>
          {slides.map((_, i) => (
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
