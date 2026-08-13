import React, { memo, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import Svg, { Line, Text as SvgText } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Icon from "./Icon";
import { COLORS } from "../../lib/constants";
import { FONTS, SHADOW } from "../../lib/typography";

/** Pixels per centimetre. 8 keeps a 1 cm step comfortably draggable. */
const PX = 8;
const BAND_H = 58;
/** Where an untouched measurement starts. */
const DEFAULT_CM = 150;

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * A tape measure the customer drags under a fixed cursor, instead of typing
 * centimetres on a keyboard.
 *
 * The digits are driven straight from the scroll offset on the UI thread, and
 * the value only reaches the parent when the gesture ends. The first version
 * pushed every centimetre into React state, which re-rendered the whole step —
 * and the eight hundred tick marks — on every frame.
 */
function RulerPicker({
  label,
  value,
  onChange,
  min = 0,
  // Wide on purpose: a field the admin left unbounded must not be silently
  // capped by the ruler at a value the old text input would have accepted.
  max = 1000,
  unit = "cm",
  onActiveChange,
}: {
  label: string;
  /** Kept as a string to match the rest of the configuration state. */
  value: string;
  onChange: (v: string) => void;
  min?: number;
  max?: number;
  unit?: string;
  /** Fires while the customer is on this measurement, to light up the plan. */
  onActiveChange?: (active: boolean) => void;
}) {
  const lo = Math.max(0, Math.floor(min));
  const hi = Math.max(lo + 1, Math.ceil(max));
  const parsed = parseFloat(value);
  const hasValue = Number.isFinite(parsed);
  const current = hasValue ? clamp(parsed, lo, hi) : clamp(DEFAULT_CM, lo, hi);

  const [width, setWidth] = useState(0);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const scroller = useRef<Animated.ScrollView>(null);
  const lastHaptic = useRef(0);
  const dragging = useRef(false);

  const offset = useSharedValue(0);
  const lastTick = useSharedValue(current);

  // An untouched measurement starts at a sensible length rather than empty, so
  // the ruler always has somewhere to sit and the step can be completed.
  useEffect(() => {
    if (!hasValue) onChange(String(clamp(DEFAULT_CM, lo, hi)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Park the ruler on the value once the width is known, and follow changes
  // that came from elsewhere (manual entry) — never mid-drag.
  useEffect(() => {
    if (!width || dragging.current) return;
    const x = (current - lo) * PX;
    offset.value = x;
    lastTick.value = current;
    scroller.current?.scrollTo({ x, animated: false });
  }, [width, current, lo, offset, lastTick]);

  const tick = () => {
    const now = Date.now();
    // One pulse per centimetre would machine-gun during a fling.
    if (now - lastHaptic.current < 35) return;
    lastHaptic.current = now;
    void Haptics.selectionAsync();
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      offset.value = e.contentOffset.x;
      const v = Math.min(hi, Math.max(lo, Math.round(e.contentOffset.x / PX) + lo));
      if (v !== lastTick.value) {
        lastTick.value = v;
        runOnJS(tick)();
      }
    },
  });

  /** The digits, recomputed on the UI thread — no React render per frame. */
  const digits = useAnimatedProps(() => {
    const v = Math.min(hi, Math.max(lo, Math.round(offset.value / PX) + lo));
    return { text: String(v), defaultValue: String(v) } as never;
  });

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    dragging.current = false;
    onActiveChange?.(false);
    const v = clamp(Math.round(e.nativeEvent.contentOffset.x / PX) + lo, lo, hi);
    onChange(String(v));
  };

  const commitTyped = () => {
    const n = parseFloat(draft.replace(",", "."));
    setTyping(false);
    onActiveChange?.(false);
    if (!Number.isFinite(n)) return;
    onChange(String(clamp(Math.round(n), lo, hi)));
  };

  const fade = ["#ffffff", "rgba(255,255,255,0)"] as const;

  return (
    /* Two layers on purpose: Android clips the elevation shadow of any view
       that also sets overflow:hidden, and the ruler must be clipped by the
       rounded corners. */
    <View style={{ borderRadius: 20, backgroundColor: COLORS.surfaceContainerLowest, ...SHADOW.card }}>
    <View
      style={{
        backgroundColor: COLORS.surfaceContainerLowest,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        paddingTop: 16,
        paddingBottom: 14,
        overflow: "hidden",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 18 }}>
        <Text
          style={{
            flex: 1,
            fontSize: 11,
            fontFamily: "Inter_600SemiBold",
            letterSpacing: 1,
            color: COLORS.outline,
          }}
        >
          {label.toUpperCase()}
        </Text>
        <TouchableOpacity
          onPress={() => {
            setDraft(String(Math.round(current)));
            setTyping(true);
            onActiveChange?.(true);
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`Saisir ${label} au clavier`}
        >
          <Icon name="pencil-outline" size={16} color={COLORS.outline} />
        </TouchableOpacity>
      </View>

      {/* The value, large enough to read while the thumb is on the ruler. */}
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "center", marginTop: 6 }}>
        {typing ? (
          <TextInput
            autoFocus
            value={draft}
            onChangeText={setDraft}
            onBlur={commitTyped}
            onSubmitEditing={commitTyped}
            keyboardType="numeric"
            style={{
              fontSize: 40,
              lineHeight: 46,
              fontFamily: FONTS.serif,
              color: COLORS.primary,
              minWidth: 110,
              textAlign: "center",
              padding: 0,
            }}
          />
        ) : (
          <AnimatedTextInput
            editable={false}
            animatedProps={digits}
            style={{
              fontSize: 40,
              lineHeight: 46,
              fontFamily: FONTS.serif,
              color: COLORS.onSurface,
              minWidth: 110,
              textAlign: "center",
              padding: 0,
            }}
          />
        )}
        <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: COLORS.outline, marginLeft: 4 }}>
          {unit}
        </Text>
      </View>

      <View
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        style={{ marginTop: 10, height: BAND_H }}
      >
        <Animated.ScrollView
          ref={scroller}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          decelerationRate="fast"
          snapToInterval={PX}
          onScroll={scrollHandler}
          onScrollBeginDrag={() => {
            dragging.current = true;
            onActiveChange?.(true);
          }}
          onScrollEndDrag={settle}
          onMomentumScrollEnd={settle}
          contentContainerStyle={{ paddingHorizontal: width / 2 }}
        >
          <Ruler lo={lo} hi={hi} />
        </Animated.ScrollView>

        {/* Ticks dissolve into the card instead of being chopped at the edge —
            the detail that makes a scrubber read as finished. */}
        <LinearGradient
          colors={fade}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          pointerEvents="none"
          style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 56 }}
        />
        <LinearGradient
          colors={fade}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 0 }}
          pointerEvents="none"
          style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 56 }}
        />

        {/* Fixed cursor: the ruler moves under it, it never moves. */}
        <View
          pointerEvents="none"
          style={{ position: "absolute", left: width / 2 - 5, top: 0, alignItems: "center" }}
        >
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary }} />
          <View style={{ width: 2, height: 30, backgroundColor: COLORS.primary, marginTop: -1 }} />
        </View>
      </View>
    </View>
    </View>
  );
}

/**
 * The graduations. Memoised on its bounds alone: without this the eight hundred
 * tick marks would be rebuilt on every render of the screen.
 */
const Ruler = memo(function Ruler({ lo, hi }: { lo: number; hi: number }) {
  const ticks: React.ReactNode[] = [];
  for (let v = lo; v <= hi; v += 1) {
    const x = (v - lo) * PX;
    const major = v % 10 === 0;
    const mid = v % 5 === 0;
    ticks.push(
      <Line
        key={v}
        x1={x}
        y1={major ? 10 : mid ? 18 : 23}
        x2={x}
        y2={32}
        stroke={major ? COLORS.onSurfaceVariant : COLORS.outlineVariant}
        strokeWidth={major ? 1.5 : 1}
        strokeLinecap="round"
      />,
    );
    if (v % 50 === 0) {
      ticks.push(
        <SvgText
          key={`l${v}`}
          x={x}
          y={48}
          fontSize={10}
          fontWeight="500"
          fill={COLORS.outline}
          textAnchor="middle"
        >
          {v}
        </SvgText>,
      );
    }
  }
  return (
    <Svg width={(hi - lo) * PX} height={BAND_H}>
      {ticks}
    </Svg>
  );
});

export default memo(RulerPicker);
