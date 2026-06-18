import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { BlurView } from "expo-blur";
import Icon from "../ui/Icon";
import { useRouter } from "expo-router";
import { COLORS } from "../../lib/constants";

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  showSearch?: boolean;
  showMenu?: boolean;
  rightAction?: React.ReactNode;
}

export default function Header({
  title,
  showBack = false,
  showSearch = false,
  showMenu = false,
  rightAction,
}: HeaderProps) {
  const router = useRouter();

  return (
    <BlurView
      intensity={80}
      tint="light"
      className="px-6 py-4 flex-row items-center"
      style={{
        borderBottomWidth: 0.5,
        borderBottomColor: COLORS.surfaceContainerLow,
      }}
    >
      {showBack && (
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Icon
            name="arrow-left"
            size={24}
            color={COLORS.primary}
          />
        </TouchableOpacity>
      )}

      {showMenu && (
        <TouchableOpacity className="mr-3">
          <Icon
            name="menu"
            size={24}
            color={COLORS.primary}
          />
        </TouchableOpacity>
      )}

      {title && (
        <Text
          className="text-lg font-semibold flex-1"
          style={{
            color: COLORS.primaryContainer,
            fontFamily: "Manrope_700Bold",
          }}
        >
          {title}
        </Text>
      )}

      <View className="flex-row items-center gap-4 ml-auto">
        {showSearch && (
          <TouchableOpacity>
            <Icon
              name="magnify"
              size={24}
              color={COLORS.primary}
            />
          </TouchableOpacity>
        )}
        {rightAction}
      </View>
    </BlurView>
  );
}
