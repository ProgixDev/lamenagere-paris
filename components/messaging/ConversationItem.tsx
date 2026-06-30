import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../lib/constants";
import { FONTS } from "../../lib/typography";
import { relativeTime, truncate } from "../../lib/utils";
import { getProductImage } from "../../lib/mock-data";
import type { Conversation } from "../../lib/types";

interface ConversationItemProps {
  conversation: Conversation;
}

export default function ConversationItem({ conversation }: ConversationItemProps) {
  const router = useRouter();
  const hasUnread = conversation.unreadCount > 0;
  const productImg = conversation.product?.images[0]
    ? getProductImage(conversation.product.images[0])
    : null;

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(main)/messages/${conversation.id}`)}
      activeOpacity={0.7}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 16,
        paddingHorizontal: 20,
        backgroundColor: hasUnread ? COLORS.surfaceContainerLow : "transparent",
      }}
    >
      {/* Product thumbnail or avatar */}
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          overflow: "hidden",
          backgroundColor: COLORS.surfaceContainer,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {productImg ? (
          <Image source={productImg} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        ) : (
          <MaterialCommunityIcons name="store-outline" size={22} color={COLORS.outline} />
        )}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
          <Text
            style={{
              fontSize: 15,
              fontFamily: hasUnread ? FONTS.bodySemibold : FONTS.bodyMedium,
              color: COLORS.onSurface,
            }}
            numberOfLines={1}
          >
            {conversation.vendorName}
          </Text>
          <Text
            style={{
              fontSize: 11,
              fontFamily: FONTS.body,
              color: hasUnread ? COLORS.primary : COLORS.outline,
            }}
          >
            {relativeTime(conversation.lastMessageAt)}
          </Text>
        </View>

        <Text
          style={{
            fontSize: 12,
            fontFamily: FONTS.bodyMedium,
            color: COLORS.onSurfaceVariant,
            marginBottom: 3,
          }}
          numberOfLines={1}
        >
          {conversation.subject}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text
            style={{
              fontSize: 12,
              fontFamily: FONTS.body,
              color: COLORS.outline,
              flex: 1,
              marginRight: 8,
            }}
            numberOfLines={1}
          >
            {truncate(conversation.lastMessage, 50)}
          </Text>

          {hasUnread && (
            <View
              style={{
                minWidth: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: COLORS.primary,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 6,
              }}
            >
              <Text style={{ fontSize: 10, fontFamily: FONTS.bodyBold, color: "#fff" }}>
                {conversation.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
