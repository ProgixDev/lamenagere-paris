import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { COLORS } from "../../lib/constants";
import { FONTS } from "../../lib/typography";

interface QuantitySelectorProps {
  quantity: number;
  onQuantityChange: (qty: number) => void;
  min?: number;
  max?: number;
  /** Small filled pill, for cart lines. */
  compact?: boolean;
  /**
   * Bordered variant sized to sit beside a large CTA — used on the product
   * page, where the stepper is the purchase control rather than an edit.
   */
  outlined?: boolean;
  /** Greys the whole control out (e.g. the product is out of stock). */
  disabled?: boolean;
}

export default function QuantitySelector({
  quantity,
  onQuantityChange,
  min = 1,
  max = 99,
  compact = false,
  outlined = false,
  disabled = false,
}: QuantitySelectorProps) {
  const canDecrement = !disabled && quantity > min;
  const canIncrement = !disabled && quantity < max;

  const handleDecrement = async () => {
    if (!canDecrement) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onQuantityChange(quantity - 1);
  };

  const handleIncrement = async () => {
    if (!canIncrement) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onQuantityChange(quantity + 1);
  };

  const tap = outlined ? 46 : compact ? 32 : 40;
  const iconSize = outlined ? 20 : compact ? 16 : 20;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        overflow: "hidden",
        opacity: disabled ? 0.4 : 1,
        ...(outlined
          ? {
              height: 52,
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: COLORS.outlineVariant,
              backgroundColor: COLORS.surfaceContainerLowest,
            }
          : {
              borderRadius: 9999,
              backgroundColor: COLORS.surfaceContainerLow,
            }),
      }}
    >
      <TouchableOpacity
        onPress={handleDecrement}
        activeOpacity={0.7}
        disabled={!canDecrement}
        accessibilityRole="button"
        accessibilityLabel="Retirer une unité"
        style={{
          width: tap,
          height: outlined ? "100%" : tap,
          alignItems: "center",
          justifyContent: "center",
          opacity: canDecrement ? 1 : 0.3,
        }}
      >
        <MaterialCommunityIcons name="minus" size={iconSize} color={COLORS.onSurface} />
      </TouchableOpacity>

      <View style={{ paddingHorizontal: compact ? 8 : 4 }}>
        <Text
          style={{
            minWidth: outlined ? 26 : 20,
            textAlign: "center",
            fontFamily: FONTS.bodyBold,
            fontSize: outlined ? 16 : 14,
            color: COLORS.onSurface,
          }}
        >
          {quantity}
        </Text>
      </View>

      <TouchableOpacity
        onPress={handleIncrement}
        activeOpacity={0.7}
        disabled={!canIncrement}
        accessibilityRole="button"
        accessibilityLabel="Ajouter une unité"
        style={{
          width: tap,
          height: outlined ? "100%" : tap,
          alignItems: "center",
          justifyContent: "center",
          opacity: canIncrement ? 1 : 0.3,
        }}
      >
        <MaterialCommunityIcons name="plus" size={iconSize} color={COLORS.onSurface} />
      </TouchableOpacity>
    </View>
  );
}
