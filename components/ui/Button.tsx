import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { COLORS } from "../../lib/constants";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: (color: string) => React.ReactNode;
}

const SIZE_PADDING: Record<string, ViewStyle> = {
  sm: { paddingHorizontal: 16, paddingVertical: 8 },
  md: { paddingHorizontal: 24, paddingVertical: 12 },
  lg: { paddingHorizontal: 32, paddingVertical: 16 },
};

const TEXT_SIZE: Record<string, number> = {
  sm: 12,
  md: 14,
  lg: 16,
};

export default function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  fullWidth = true,
  icon,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const onPressIn = () => {
    if (isDisabled) return;
    scale.value = withTiming(0.96, { duration: 90 });
  };
  const onPressOut = () => {
    scale.value = withTiming(1, { duration: 150 });
  };

  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  if (variant === "primary") {
    return (
      <Animated.View style={[fullWidth ? { width: "100%" } : undefined, animatedStyle]}>
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={isDisabled}
        activeOpacity={0.9}
        style={[
          fullWidth ? { width: "100%" } : undefined,
          { opacity: isDisabled ? 0.5 : 1 },
        ]}
      >
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryContainer]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            SIZE_PADDING[size],
            {
              borderRadius: 9999,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              minHeight: 44,
              shadowColor: COLORS.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 4,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.onPrimary} size="small" />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {icon && icon(COLORS.onPrimary)}
              <Text
                style={{
                  color: "#ffffff",
                  fontFamily: "Manrope_700Bold",
                  fontSize: TEXT_SIZE[size],
                  textTransform: "uppercase",
                  letterSpacing: 2,
                }}
              >
                {label}
              </Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
      </Animated.View>
    );
  }

  const isSecondary = variant === "secondary";
  const isDanger = variant === "danger";

  return (
    <Animated.View style={[fullWidth ? { width: "100%" } : undefined, animatedStyle]}>
    <TouchableOpacity
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        SIZE_PADDING[size],
        {
          borderRadius: 9999,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          minHeight: 44,
          opacity: isDisabled ? 0.5 : 1,
          backgroundColor: isDanger ? COLORS.error : "transparent",
          borderWidth: isSecondary ? 1 : 0,
          borderColor: isSecondary ? `${COLORS.outlineVariant}33` : undefined,
        },
        fullWidth ? { width: "100%" } : undefined,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={isDanger ? "#fff" : COLORS.secondary}
          size="small"
        />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {icon && icon(isDanger ? "#fff" : COLORS.secondary)}
          <Text
            style={{
              fontFamily: "Manrope_700Bold",
              fontSize: TEXT_SIZE[size],
              textTransform: "uppercase",
              letterSpacing: 2,
              color: isDanger ? "#ffffff" : COLORS.secondary,
            }}
          >
            {label}
          </Text>
        </View>
      )}
    </TouchableOpacity>
    </Animated.View>
  );
}
