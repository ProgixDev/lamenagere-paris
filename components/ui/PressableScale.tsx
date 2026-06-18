import React from "react";
import { Pressable, type ViewStyle, type StyleProp } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

interface PressableScaleProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** How far it shrinks while pressed. Default 0.97. */
  scaleTo?: number;
  disabled?: boolean;
}

/**
 * Tactile wrapper that gently scales its content down while pressed. Use for
 * cards, product tiles and other tappable surfaces that aren't a <Button>.
 */
export default function PressableScale({
  children,
  onPress,
  style,
  scaleTo = 0.97,
  disabled = false,
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => {
        if (disabled) return;
        scale.value = withTiming(scaleTo, { duration: 90 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 150 });
      }}
    >
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
