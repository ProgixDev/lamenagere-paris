import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Icon from "./ui/Icon";
import { COLORS } from "../lib/constants";
import { useNotifInboxStore, selectUnreadCount } from "../features/notifications/inbox";

export default function SearchBar({
  placeholder = "Rechercher La Ménagère",
  showNotifications = false,
  onFilterPress,
  filterActive = false,
}: {
  placeholder?: string;
  showNotifications?: boolean;
  onFilterPress?: () => void;
  filterActive?: boolean;
}) {
  const router = useRouter();
  const unread = useNotifInboxStore(selectUnreadCount);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 12,
        paddingTop: 4,
        paddingBottom: 8,
      }}
    >
      {showNotifications && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/(main)/notifications")}
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: COLORS.outlineVariant,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="bell-outline" size={22} color={COLORS.onSurface} />
          {unread > 0 && (
            <View
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                minWidth: 16,
                height: 16,
                paddingHorizontal: 3,
                borderRadius: 8,
                backgroundColor: COLORS.secondary,
                borderWidth: 1.5,
                borderColor: "#fff",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 9, fontFamily: "Manrope_800ExtraBold", color: "#fff" }}>
                {unread > 9 ? "9+" : unread}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#fff",
          borderRadius: 14,
          borderWidth: 1,
          borderColor: COLORS.outlineVariant,
          paddingLeft: 18,
          paddingRight: 6,
          paddingVertical: 6,
          gap: 8,
        }}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/(main)/search")}
          style={{ flex: 1 }}
        >
          <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: COLORS.outline }}>
            {placeholder}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/(main)/search")}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              backgroundColor: COLORS.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialCommunityIcons name="magnify" size={18} color="#fff" />
          </View>
        </TouchableOpacity>
      </View>

      {onFilterPress && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onFilterPress}
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: COLORS.outlineVariant,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="tune" size={22} color={COLORS.onSurface} />
          {filterActive && (
            <View
              style={{
                position: "absolute",
                top: 9,
                right: 9,
                width: 9,
                height: 9,
                borderRadius: 5,
                backgroundColor: COLORS.secondary,
                borderWidth: 1.5,
                borderColor: "#fff",
              }}
            />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}
