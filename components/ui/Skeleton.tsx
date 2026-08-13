import React, { useEffect } from "react";
import { View, type DimensionValue, type ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "../../lib/constants";

/** How wide the travelling highlight is, as a share of the placeholder. */
const SWEEP = 0.55;

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * A placeholder that mimics the shape of the content still loading.
 *
 * The highlight sweeps across rather than pulsing the whole block: a pulse
 * reads as "something is broken and blinking", a sweep reads as "this is
 * filling in". Falls back to a flat block when the system asks for reduced
 * motion.
 */
export default function Skeleton({
  width = "100%",
  height = 16,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(-1);

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
  }, [progress, reduceMotion]);

  const sweep = useAnimatedStyle(() => ({
    transform: [{ translateX: `${progress.value * 100}%` }],
  }));

  return (
    <View
      style={[
        { width, height, borderRadius, backgroundColor: COLORS.surfaceContainer, overflow: "hidden" },
        style,
      ]}
    >
      {!reduceMotion && (
        <Animated.View style={[{ width: `${SWEEP * 100}%`, height: "100%" }, sweep]}>
          <LinearGradient
            colors={["transparent", "rgba(255,255,255,0.75)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      )}
    </View>
  );
}

/** A product tile: 4:5 image, title, price — mirrors the real home card. */
export function ProductCardSkeleton({ width }: { width?: DimensionValue }) {
  return (
    <View style={{ width: width ?? "48%", marginBottom: 20 }}>
      <Skeleton height={220} borderRadius={14} />
      <View style={{ marginTop: 10, gap: 7 }}>
        <Skeleton height={13} width="85%" />
        <Skeleton height={13} width="55%" />
        <Skeleton height={16} width="40%" />
      </View>
    </View>
  );
}

/** Grid of product tiles, for the home feed and category listings. */
export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        paddingHorizontal: 16,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </View>
  );
}

/** The collection cards of the Categories tab: a wide banner plus its caption. */
export function CategoryGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={{ paddingHorizontal: 16, gap: 18 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i}>
          <Skeleton height={150} borderRadius={16} />
          <View style={{ marginTop: 10, gap: 7 }}>
            <Skeleton height={16} width="55%" />
            <Skeleton height={12} width="30%" />
          </View>
        </View>
      ))}
    </View>
  );
}

/** A product page: gallery, title, price, then body copy. */
export function ProductDetailSkeleton() {
  return (
    <View>
      <Skeleton height={360} borderRadius={0} />
      <View style={{ padding: 16, gap: 12 }}>
        <Skeleton height={26} width="75%" />
        <Skeleton height={18} width="35%" />
        <View style={{ height: 8 }} />
        <Skeleton height={13} width="100%" />
        <Skeleton height={13} width="92%" />
        <Skeleton height={13} width="64%" />
      </View>
    </View>
  );
}

/** A list row with a leading thumbnail — orders, messages, addresses. */
export function ListRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={{ paddingHorizontal: 16, gap: 14 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Skeleton width={56} height={56} borderRadius={14} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton height={14} width="60%" />
            <Skeleton height={12} width="38%" />
          </View>
        </View>
      ))}
    </View>
  );
}

/** An order card: header line, two product rows, total. */
export function OrderCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={{ paddingHorizontal: 16, gap: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            backgroundColor: COLORS.surfaceContainerLowest,
            borderRadius: 16,
            padding: 16,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Skeleton height={14} width="40%" />
            <Skeleton height={20} width={80} borderRadius={10} />
          </View>
          <Skeleton height={12} width="30%" />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Skeleton width={48} height={48} borderRadius={10} />
            <Skeleton width={48} height={48} borderRadius={10} />
          </View>
        </View>
      ))}
    </View>
  );
}
