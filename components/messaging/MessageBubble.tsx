import React from "react";
import { View, Text, Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { COLORS } from "../../lib/constants";
import type { Message } from "../../lib/types";

interface MessageBubbleProps {
  message: Message;
  showAvatar?: boolean;
}

const MEDIA_W = 200;

function VideoAttachment({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  return (
    <VideoView
      player={player}
      style={{ width: MEDIA_W, height: MEDIA_W, borderRadius: 12, backgroundColor: "#000" }}
      contentFit="cover"
      nativeControls
    />
  );
}

export default function MessageBubble({ message, showAvatar = true }: MessageBubbleProps) {
  const isUser = message.sender === "user";
  const hasText = !!message.content?.trim();
  const attachments = message.attachments ?? [];

  const time = new Date(message.createdAt).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View
      style={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        maxWidth: "78%",
        marginBottom: 10,
        flexDirection: isUser ? "row-reverse" : "row",
        alignItems: "flex-end",
        gap: 8,
      }}
    >
      {/* Vendor avatar */}
      {!isUser && showAvatar && (
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: COLORS.primary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialCommunityIcons name="store" size={14} color="#fff" />
        </View>
      )}
      {!isUser && !showAvatar && <View style={{ width: 28 }} />}

      <View style={{ alignItems: isUser ? "flex-end" : "flex-start" }}>
        {/* Attachments */}
        {attachments.map((att, i) =>
          att.type === "video" ? (
            <View key={`${att.url}-${i}`} style={{ marginBottom: 6 }}>
              <VideoAttachment uri={att.url} />
            </View>
          ) : (
            <Image
              key={`${att.url}-${i}`}
              source={{ uri: att.url }}
              style={{ width: MEDIA_W, height: MEDIA_W, borderRadius: 12, marginBottom: 6 }}
              resizeMode="cover"
            />
          ),
        )}

        {/* Text bubble */}
        {hasText && (
          <View
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              backgroundColor: isUser ? COLORS.primary : "#ffffff",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              borderBottomLeftRadius: isUser ? 16 : 4,
              borderBottomRightRadius: isUser ? 4 : 16,
              shadowColor: isUser ? "transparent" : "rgba(0,0,0,0.04)",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 1,
              shadowRadius: 8,
              elevation: isUser ? 0 : 1,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontFamily: "Inter_400Regular",
                color: isUser ? "#ffffff" : COLORS.onSurface,
                lineHeight: 20,
              }}
            >
              {message.content}
            </Text>
          </View>
        )}
        <Text
          style={{
            fontSize: 10,
            fontFamily: "Inter_400Regular",
            color: COLORS.outline,
            marginTop: 4,
            textAlign: isUser ? "right" : "left",
            marginLeft: isUser ? 0 : 2,
            marginRight: isUser ? 2 : 0,
          }}
        >
          {time}
        </Text>
      </View>
    </View>
  );
}
