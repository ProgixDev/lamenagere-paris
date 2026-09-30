import React from "react";
import { View, Text, TouchableOpacity, Image, Modal, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Icon from "./Icon";
import { COLORS } from "../../lib/constants";
import { formatPrice } from "../../lib/utils";

const MAX_SCALE = 4;

interface Props {
  uri: string;
  visible: boolean;
  onClose: () => void;
  title?: string;
  priceCents?: number;
  /** When given, the viewer offers to pick / unpick the item without closing. */
  selected?: boolean;
  onToggle?: () => void;
}

/**
 * Full-screen photo with pinch, pan and double-tap zoom. Built on
 * gesture-handler rather than ScrollView zoom, which only exists on iOS.
 */
export default function ImageViewerModal({ uri, visible, onClose, title, priceCents, selected, onToggle }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const reset = () => {
    "worklet";
    scale.value = withTiming(1);
    savedScale.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedTx.value = 0;
    savedTy.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_SCALE, Math.max(1, savedScale.value * e.scale));
    })
    .onEnd(() => {
      if (scale.value <= 1.02) reset();
      else savedScale.value = scale.value;
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (scale.value <= 1) return;
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        reset();
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const close = () => {
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      {/* Modals render outside the app's root view, so gestures need their own root. */}
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.96)" }}>
        <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
          <Animated.View style={[{ flex: 1, alignItems: "center", justifyContent: "center" }, imageStyle]}>
            <Image source={{ uri }} style={{ width, height: height * 0.8 }} resizeMode="contain" />
          </Animated.View>
        </GestureDetector>

        <TouchableOpacity
          onPress={close}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
          style={{
            position: "absolute",
            top: insets.top + 12,
            right: 16,
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: "rgba(255,255,255,0.16)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="close" size={22} color="#fff" />
        </TouchableOpacity>

        {(title || onToggle) && (
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: insets.bottom + 16,
              backgroundColor: "rgba(0,0,0,0.6)",
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              {title ? (
                <Text numberOfLines={2} style={{ color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" }}>
                  {title}
                </Text>
              ) : null}
              {priceCents ? (
                <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 2 }}>
                  +{formatPrice(priceCents / 100)}
                </Text>
              ) : null}
            </View>
            {onToggle && (
              <TouchableOpacity
                onPress={onToggle}
                accessibilityRole="button"
                accessibilityState={{ checked: !!selected }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 16,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: selected ? "#fff" : "rgba(255,255,255,0.16)",
                }}
              >
                <Icon name={selected ? "check" : "plus"} size={16} color={selected ? COLORS.primary : "#fff"} />
                <Text style={{ color: selected ? COLORS.primary : "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" }}>
                  {selected ? "Sélectionné" : "Choisir"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}
