import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { COLORS } from "../../lib/constants";

const THUMB = 24;
const TRACK_H = 4;
const HIST_H = 40;

interface RangeSliderProps {
  min: number;
  max: number;
  lowValue: number;
  highValue: number;
  onChange: (low: number, high: number) => void;
  step?: number;
  /** Optional bar heights (0..1) for the decorative histogram behind the track. */
  histogram?: number[];
}

/**
 * Lightweight dual-thumb range slider built on gesture-handler + reanimated
 * (no native slider dependency). Thumbs are clamped so low <= high.
 */
export default function RangeSlider({
  min,
  max,
  lowValue,
  highValue,
  onChange,
  step = 1,
  histogram,
}: RangeSliderProps) {
  const [trackW, setTrackW] = useState(0);
  const span = Math.max(1, max - min);

  // Thumb centre positions in px along the usable track (0..trackW).
  const lowX = useSharedValue(0);
  const highX = useSharedValue(0);

  const valueToX = (v: number) => ((v - min) / span) * trackW;

  // Keep the thumbs in sync when bounds / external values / track width change.
  useEffect(() => {
    if (trackW <= 0) return;
    lowX.value = valueToX(lowValue);
    highX.value = valueToX(highValue);
  }, [trackW, lowValue, highValue, min, max]);

  const emit = (lx: number, hx: number) => {
    const raw = (x: number) => min + (x / trackW) * span;
    const snap = (v: number) =>
      Math.min(max, Math.max(min, Math.round(v / step) * step));
    onChange(snap(raw(lx)), snap(raw(hx)));
  };

  const startLow = useSharedValue(0);
  const startHigh = useSharedValue(0);

  const lowGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          startLow.value = lowX.value;
        })
        .onUpdate((e) => {
          const next = Math.min(
            highX.value,
            Math.max(0, startLow.value + e.translationX),
          );
          lowX.value = next;
          runOnJS(emit)(next, highX.value);
        }),
    [trackW, highValue],
  );

  const highGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          startHigh.value = highX.value;
        })
        .onUpdate((e) => {
          const next = Math.max(
            lowX.value,
            Math.min(trackW, startHigh.value + e.translationX),
          );
          highX.value = next;
          runOnJS(emit)(lowX.value, next);
        }),
    [trackW, lowValue],
  );

  const lowThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: lowX.value - THUMB / 2 }],
  }));
  const highThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: highX.value - THUMB / 2 }],
  }));
  const fillStyle = useAnimatedStyle(() => ({
    left: lowX.value,
    width: Math.max(0, highX.value - lowX.value),
  }));

  const bars = histogram && histogram.length > 0 ? histogram : DEFAULT_BARS;

  return (
    <View style={{ paddingHorizontal: THUMB / 2 }}>
      {/* Histogram */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          height: HIST_H,
          marginBottom: 6,
        }}
        pointerEvents="none"
      >
        {bars.map((h, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              marginHorizontal: 1,
              height: Math.max(3, h * HIST_H),
              borderRadius: 2,
              backgroundColor: COLORS.outlineVariant + "66",
            }}
          />
        ))}
      </View>

      {/* Track */}
      <View
        onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
        style={{ height: THUMB, justifyContent: "center" }}
      >
        <View
          style={{
            height: TRACK_H,
            borderRadius: TRACK_H,
            backgroundColor: COLORS.outlineVariant + "88",
          }}
        />
        <Animated.View
          style={[
            {
              position: "absolute",
              height: TRACK_H,
              borderRadius: TRACK_H,
              backgroundColor: COLORS.primary,
            },
            fillStyle,
          ]}
        />

        {/* Thumbs */}
        <GestureDetector gesture={lowGesture}>
          <Animated.View style={[thumbBase, lowThumbStyle]} hitSlop={12} />
        </GestureDetector>
        <GestureDetector gesture={highGesture}>
          <Animated.View style={[thumbBase, highThumbStyle]} hitSlop={12} />
        </GestureDetector>
      </View>
    </View>
  );
}

const thumbBase = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  width: THUMB,
  height: THUMB,
  borderRadius: THUMB / 2,
  backgroundColor: "#fff",
  borderWidth: 2,
  borderColor: COLORS.primary,
  shadowColor: "#000",
  shadowOpacity: 0.15,
  shadowRadius: 3,
  shadowOffset: { width: 0, height: 1 },
  elevation: 3,
};

// Static fallback silhouette when no price distribution is available.
const DEFAULT_BARS = [
  0.2, 0.3, 0.25, 0.4, 0.55, 0.45, 0.6, 0.8, 0.7, 0.9, 0.75, 0.85, 0.6, 0.7,
  0.5, 0.55, 0.4, 0.45, 0.35, 0.3, 0.4, 0.3, 0.25, 0.35, 0.2, 0.3, 0.22, 0.18,
  0.25, 0.15, 0.2, 0.12,
];
