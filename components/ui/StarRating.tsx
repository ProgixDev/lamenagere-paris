import React from "react";
import { View, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../lib/constants";

interface StarRatingProps {
  rating: number;
  size?: number;
  /** When provided, stars become tappable and call this with the chosen value. */
  onChange?: (value: number) => void;
}

export default function StarRating({ rating, size = 16, onChange }: StarRatingProps) {
  return (
    <View className="flex-row gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const icon = (
          <MaterialCommunityIcons
            name={star <= rating ? "star" : "star-outline"}
            size={size}
            color={COLORS.secondary}
          />
        );
        if (!onChange) return <React.Fragment key={star}>{icon}</React.Fragment>;
        return (
          <TouchableOpacity key={star} onPress={() => onChange(star)} hitSlop={6} activeOpacity={0.7}>
            {icon}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
