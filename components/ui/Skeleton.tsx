import React, { useEffect } from "react";
import { View, type ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { COLORS } from "../../lib/constants";

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export default function Skeleton({
  width = "100%",
  height = 16,
  borderRadius = 4,
  style,
}: SkeletonProps) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 800 }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: COLORS.surfaceContainer,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function SkeletonCard() {
  return (
    <View className="gap-3">
      <Skeleton height={200} borderRadius={8} />
      <Skeleton height={14} width="70%" />
      <Skeleton height={14} width="40%" />
    </View>
  );
}

export function SkeletonProductGrid() {
  return (
    <View className="flex-row flex-wrap gap-4 px-6">
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={{ width: "47%" }} className="gap-3">
          <Skeleton height={220} borderRadius={8} />
          <Skeleton height={12} width="80%" />
          <Skeleton height={12} width="50%" />
        </View>
      ))}
    </View>
  );
}

/**
 * Two-column skeleton that mirrors the premium product card (4:5 image, name,
 * price). Shown on the home feed's first load instead of a bare spinner.
 */
export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  const rows = Array.from({ length: Math.ceil(count / 2) });
  return (
    <View style={{ paddingHorizontal: 16 }}>
      {rows.map((_, r) => (
        <View key={r} style={{ flexDirection: "row", gap: 14, marginBottom: 14 }}>
          {[0, 1].map((c) => (
            <View key={c} style={{ flex: 1 }}>
              <Skeleton height={210} borderRadius={14} />
              <Skeleton height={13} width="80%" borderRadius={4} style={{ marginTop: 10 }} />
              <Skeleton height={18} width="45%" borderRadius={4} style={{ marginTop: 8 }} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
