import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { COLORS } from "../../lib/constants";
import { formatPrice, formatDimensions } from "../../lib/utils";
import { openingTypeLabel } from "../../lib/opening-types";
import { summarizeConfiguration } from "../../lib/config-blocks";
import { getProductImage } from "../../lib/mock-data";
import type { CartItem as CartItemType } from "../../lib/types";
import QuantitySelector from "../ui/QuantitySelector";

interface CartItemProps {
  item: CartItemType;
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
}

export default function CartItem({
  item,
  onUpdateQuantity,
  onRemove,
}: CartItemProps) {
  const { product, quantity, customDimensions, openingType, configuration, calculatedPrice } = item;
  const price = calculatedPrice || product.price || 0;
  const imgSource = getProductImage(product.images[0]);
  const configSummary = configuration?.length ? summarizeConfiguration(configuration) : "";

  const handleRemove = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRemove();
  };

  return (
    <View
      style={{
        backgroundColor: "#ffffff",
        borderRadius: 14,
        padding: 14,
        shadowColor: "rgba(0,0,0,0.06)",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 12,
        elevation: 2,
      }}
    >
      <View style={{ flexDirection: "row", gap: 14 }}>
        {/* Thumbnail */}
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 10,
            overflow: "hidden",
            backgroundColor: "#F5E6DC",
          }}
        >
          {imgSource ? (
            <Image
              source={imgSource}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <MaterialCommunityIcons name="image-outline" size={28} color={COLORS.surfaceDim} />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={{ flex: 1, justifyContent: "space-between" }}>
          <Text
            style={{
              fontSize: 14,
              fontFamily: "Manrope_700Bold",
              color: COLORS.onSurface,
            }}
            numberOfLines={1}
          >
            {product.name}
          </Text>

          {(customDimensions || product.dimensions) && (
            <Text
              style={{
                fontSize: 11,
                fontFamily: "Inter_400Regular",
                color: COLORS.outline,
                marginTop: 2,
              }}
            >
              {customDimensions
                ? formatDimensions(customDimensions.width, customDimensions.height)
                : product.dimensions
                  ? formatDimensions(product.dimensions.width, product.dimensions.height)
                  : ""}
              {openingType ? ` · ${openingTypeLabel(openingType)}` : ""}
            </Text>
          )}
          {openingType && !customDimensions && !product.dimensions && (
            <Text
              style={{
                fontSize: 11,
                fontFamily: "Inter_400Regular",
                color: COLORS.outline,
                marginTop: 2,
              }}
            >
              {openingTypeLabel(openingType)}
            </Text>
          )}

          {configSummary ? (
            <Text
              style={{
                fontSize: 11,
                fontFamily: "Inter_400Regular",
                color: COLORS.outline,
                marginTop: 2,
              }}
              numberOfLines={2}
            >
              {configSummary}
            </Text>
          ) : null}

          <Text
            style={{
              fontSize: 16,
              fontFamily: "Manrope_700Bold",
              color: COLORS.secondary,
              marginTop: 4,
            }}
          >
            {formatPrice(price)}
          </Text>
        </View>
      </View>

      {/* Bottom row: remove + quantity */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 12,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: "#f5f5f5",
        }}
      >
        <TouchableOpacity
          onPress={handleRemove}
          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={15} color={COLORS.outline} />
          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.outline }}>
            Supprimer
          </Text>
        </TouchableOpacity>

        <QuantitySelector
          quantity={quantity}
          onQuantityChange={onUpdateQuantity}
          compact
        />
      </View>
    </View>
  );
}
