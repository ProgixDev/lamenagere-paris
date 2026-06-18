import React from "react";
import { View, Text, TouchableOpacity, Dimensions } from "react-native";
import { Image } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { COLORS } from "../../lib/constants";
import { priceTagLabel } from "../../lib/pricing";
import type { Product } from "../../lib/types";
import { useFavoritesStore } from "../../features/favorites/store";
import { useCartStore } from "../../features/cart/store";

interface ProductCardProps {
  product: Product;
  variant?: "grid" | "horizontal";
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - 48 - 16) / 2;

export default function ProductCard({
  product,
  variant = "grid",
}: ProductCardProps) {
  const router = useRouter();
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  const isFavorited = useFavoritesStore((s) => s.favorites.includes(product.id));
  const addItem = useCartStore((s) => s.addItem);

  const handlePress = () => {
    router.push(`/(main)/products/${product.id}`);
  };

  const handleFavorite = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleFavorite(product.id);
  };

  const handleAdd = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addItem(product, 1);
  };

  if (variant === "horizontal") {
    return (
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.9}
        style={{ width: 160 }}
        className="gap-3"
      >
        <View
          className="rounded-xl overflow-hidden"
          style={{
            width: 160,
            height: 200,
            backgroundColor: COLORS.surfaceContainerLowest,
          }}
        >
          <Image
            source={{ uri: product.images[0] }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            placeholder={{ blurhash: "LGF5]+Yk^6#M@-5c,1J5@[or[Q6." }}
            transition={300}
          />
        </View>
        <Text
          className="text-sm font-semibold"
          style={{ color: COLORS.onSurface }}
          numberOfLines={1}
        >
          {product.name}
        </Text>
        <Text
          className="font-bold text-sm"
          style={{
            color: COLORS.secondary,
            fontFamily: "Manrope_700Bold",
          }}
        >
          {priceTagLabel(product)}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.9}
      style={{ width: CARD_WIDTH }}
      className="gap-4"
    >
      <View
        className="rounded-xl overflow-hidden"
        style={{
          width: CARD_WIDTH,
          height: CARD_WIDTH * 1.25,
          backgroundColor: COLORS.surfaceContainerLowest,
          shadowColor: "rgba(26, 28, 28, 0.04)",
          shadowOffset: { width: 0, height: 20 },
          shadowOpacity: 1,
          shadowRadius: 40,
          elevation: 2,
        }}
      >
        <Image
          source={{ uri: product.images[0] }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          placeholder={{ blurhash: "LGF5]+Yk^6#M@-5c,1J5@[or[Q6." }}
          transition={300}
        />
        <TouchableOpacity
          onPress={handleFavorite}
          className="absolute top-3 right-3 w-8 h-8 rounded-full items-center justify-center"
          style={{ backgroundColor: "rgba(255,255,255,0.8)" }}
        >
          <MaterialCommunityIcons
            name={isFavorited ? "heart" : "heart-outline"}
            size={18}
            color={COLORS.primary}
          />
        </TouchableOpacity>
      </View>

      <View className="px-1">
        <Text
          className="text-sm font-semibold mb-1"
          style={{ color: COLORS.onSurface }}
          numberOfLines={1}
        >
          {product.name}
        </Text>
        <View className="flex-row items-center justify-between">
          <Text
            className="font-bold"
            style={{
              color: COLORS.secondary,
              fontFamily: "Manrope_700Bold",
            }}
          >
            {priceTagLabel(product)}
          </Text>
          {product.productType === "standard" && (
            <TouchableOpacity onPress={handleAdd}>
              <Text
                className="text-[10px] uppercase tracking-tighter"
                style={{
                  color: COLORS.secondary,
                  borderBottomWidth: 1,
                  borderBottomColor: `${COLORS.primary}33`,
                }}
              >
                Ajouter
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
