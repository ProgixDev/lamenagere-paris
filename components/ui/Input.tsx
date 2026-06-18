import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  type KeyboardTypeOptions,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  interpolateColor,
  Easing,
} from "react-native-reanimated";
import Icon from "./Icon";
import { COLORS } from "../../lib/constants";

interface InputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  suffix?: string;
  disabled?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}

const AnimatedText = Animated.createAnimatedComponent(Text);

export default function Input({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  secureTextEntry = false,
  keyboardType,
  suffix,
  disabled = false,
  multiline = false,
  numberOfLines,
  autoCapitalize = "none",
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // The label floats to the top whenever the field is focused or already
  // holds a value; otherwise it rests inside the field like a placeholder.
  const hasLabel = !!label;
  const active = isFocused || value.length > 0;
  const progress = useSharedValue(active ? 1 : 0);
  const focusRing = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, {
      duration: 180,
      easing: Easing.out(Easing.quad),
    });
  }, [active, progress]);

  useEffect(() => {
    focusRing.value = withTiming(isFocused ? 1 : 0, { duration: 160 });
  }, [isFocused, focusRing]);

  const containerStyle = useAnimatedStyle(() => ({
    borderColor: error
      ? COLORS.error
      : interpolateColor(
          focusRing.value,
          [0, 1],
          [COLORS.outlineVariant, COLORS.primary],
        ),
    backgroundColor: interpolateColor(
      focusRing.value,
      [0, 1],
      [COLORS.surfaceContainerLow, COLORS.surfaceContainerLowest],
    ),
  }));

  const labelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [0, -11]) }],
    fontSize: interpolate(progress.value, [0, 1], [15, 11]),
    color: error
      ? COLORS.error
      : interpolateColor(
          focusRing.value,
          [0, 1],
          [COLORS.outline, COLORS.primary],
        ),
  }));

  return (
    <View>
      <Animated.View
        style={[
          {
            borderWidth: 1.5,
            borderRadius: 14,
            paddingHorizontal: 16,
            paddingTop: hasLabel ? 20 : 0,
            paddingBottom: hasLabel ? 6 : 0,
            minHeight: multiline ? 96 : 58,
            flexDirection: "row",
            alignItems: multiline ? "flex-start" : "center",
            opacity: disabled ? 0.55 : 1,
          },
          containerStyle,
        ]}
      >
        {hasLabel && (
          <AnimatedText
            // Tapping the resting label focuses the field, like a placeholder.
            style={[
              {
                position: "absolute",
                left: 16,
                letterSpacing: 0.3,
                fontFamily: "Inter_500Medium",
              },
              labelStyle,
            ]}
            pointerEvents="none"
          >
            {label}
          </AnimatedText>
        )}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          // Only show the placeholder once the label has floated up, so the two
          // never overlap.
          placeholder={!hasLabel || active ? placeholder : undefined}
          placeholderTextColor={COLORS.surfaceDim}
          secureTextEntry={secureTextEntry && !showPassword}
          keyboardType={keyboardType}
          editable={!disabled}
          multiline={multiline}
          numberOfLines={numberOfLines}
          autoCapitalize={autoCapitalize}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            flex: 1,
            paddingVertical: multiline ? 8 : 6,
            paddingHorizontal: 0,
            fontSize: 15,
            color: COLORS.onSurface,
            backgroundColor: "transparent",
            fontFamily: "Inter_400Regular",
            textAlignVertical: multiline ? "top" : "center",
          }}
        />

        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={{ padding: 6, marginLeft: 4 }}
            hitSlop={8}
          >
            <Icon
              name={showPassword ? "eye-off" : "eye"}
              size={20}
              color={COLORS.outline}
            />
          </TouchableOpacity>
        )}

        {suffix && (
          <Text
            style={{
              fontSize: 15,
              marginLeft: 8,
              color: COLORS.outline,
              fontFamily: "Inter_500Medium",
            }}
          >
            {suffix}
          </Text>
        )}
      </Animated.View>

      {error && (
        <Text
          style={{
            fontSize: 12,
            marginTop: 6,
            marginLeft: 4,
            color: COLORS.error,
            fontFamily: "Inter_400Regular",
          }}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
