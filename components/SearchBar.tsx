import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import Icon from "./ui/Icon";
import { COLORS } from "../lib/constants";

export default function SearchBar({
  placeholder = "Rechercher La Ménagère",
  onFilterPress,
  filterActive = false,
}: {
  placeholder?: string;
  onFilterPress?: () => void;
  filterActive?: boolean;
}) {
  const router = useRouter();

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: COLORS.surfaceContainerLowest,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: COLORS.outlineVariant,
          paddingLeft: 20,
          paddingRight: onFilterPress ? 8 : 20,
          paddingVertical: 13,
          gap: 8,
        }}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/(main)/search")}
          accessibilityRole="search"
          accessibilityLabel={placeholder}
          style={{ flex: 1 }}
        >
          <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: COLORS.outline }}>
            {placeholder}
          </Text>
        </TouchableOpacity>

        {onFilterPress && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onFilterPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Filtres"
            style={{ paddingHorizontal: 8, justifyContent: "center" }}
          >
            <Icon name="tune" size={20} color={COLORS.onSurface} />
            {filterActive && (
              <View
                style={{
                  position: "absolute",
                  top: -2,
                  right: 2,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: COLORS.primary,
                  borderWidth: 1.5,
                  borderColor: COLORS.surfaceContainerLowest,
                }}
              />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
