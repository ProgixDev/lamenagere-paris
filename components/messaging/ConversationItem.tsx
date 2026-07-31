import React from "react";
import { View, Text, Image } from "react-native";
import { useRouter } from "expo-router";
import Icon from "../ui/Icon";
import PressableScale from "../ui/PressableScale";
import { COLORS, BRAND } from "../../lib/constants";
import { FONTS, SHADOW } from "../../lib/typography";
import { relativeTime } from "../../lib/utils";
import type { Conversation } from "../../lib/types";
import { productCoverSource } from "../../lib/product-media";

interface ConversationItemProps {
  conversation: Conversation;
}

/**
 * A thread reads as a dossier about a piece, not a chat row: the subject is
 * the serif headline, the product is the identity, and unread state is a
 * brand-blue rule flush to the leading edge — the same full-bleed device the
 * catalogue cards use for prices, here meaning "this one needs you".
 */
export default function ConversationItem({ conversation }: ConversationItemProps) {
  const router = useRouter();
  const hasUnread = conversation.unreadCount > 0;
  const productImg = productCoverSource(conversation.product);

  return (
    <PressableScale
      onPress={() => router.push(`/(main)/messages/${conversation.id}`)}
      style={{
        flexDirection: "row",
        backgroundColor: COLORS.surfaceContainerLowest,
        borderRadius: 16,
        overflow: "hidden",
        ...SHADOW.card,
      }}
    >
      {/* Unread rule — flush to the card's leading edge */}
      <View style={{ width: 3, backgroundColor: hasUnread ? BRAND.blue : "transparent" }} />

      <View style={{ flex: 1, flexDirection: "row", gap: 14, padding: 14 }}>
        {/* The piece being discussed */}
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            overflow: "hidden",
            backgroundColor: COLORS.surfaceContainer,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {productImg ? (
            <Image source={productImg} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          ) : (
            <Icon name="store-outline" size={22} color={COLORS.outline} />
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          {/* Vendor + time */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              marginBottom: 2,
            }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 10,
                letterSpacing: 1.4,
                textTransform: "uppercase",
                fontFamily: FONTS.bodySemibold,
                color: COLORS.outline,
              }}
              numberOfLines={1}
            >
              {conversation.vendorName}
            </Text>
            <Text
              style={{
                fontSize: 11,
                fontFamily: hasUnread ? FONTS.bodySemibold : FONTS.body,
                color: hasUnread ? BRAND.blue : COLORS.outline,
              }}
            >
              {relativeTime(conversation.lastMessageAt)}
            </Text>
          </View>

          {/* Subject — the dossier title */}
          <Text
            style={{
              fontFamily: hasUnread ? FONTS.serifBold : FONTS.serif,
              fontSize: 19,
              lineHeight: 23,
              color: COLORS.onSurface,
              marginBottom: 3,
            }}
            numberOfLines={1}
          >
            {conversation.subject}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text
              style={{
                flex: 1,
                fontSize: 13,
                lineHeight: 18,
                fontFamily: FONTS.body,
                color: hasUnread ? COLORS.onSurfaceVariant : COLORS.outline,
              }}
              numberOfLines={1}
            >
              {conversation.lastMessage}
            </Text>

            {hasUnread && (
              <View
                style={{
                  minWidth: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: BRAND.blue,
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
      </View>
    </PressableScale>
  );
}
