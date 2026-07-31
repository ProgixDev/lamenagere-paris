import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import Icon from "../ui/Icon";
import { COLORS, BRAND } from "../../lib/constants";
import { FONTS } from "../../lib/typography";
import type { Message } from "../../lib/types";

interface MessageBubbleProps {
  message: Message;
  /** First of a run from this sender — carries the avatar and full corners. */
  showAvatar?: boolean;
  /** Last of a run — only this one shows a timestamp, so runs stay quiet. */
  showTime?: boolean;
}

const MEDIA_W = 200;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

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

function ImageAttachment({ uri }: { uri: string }) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <>
      <TouchableOpacity activeOpacity={0.9} onPress={() => setFullscreen(true)}>
        <Image
          source={{ uri }}
          style={{ width: MEDIA_W, height: MEDIA_W, borderRadius: 12 }}
          resizeMode="cover"
        />
        {/* Expand affordance */}
        <View
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: "rgba(0,0,0,0.5)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialCommunityIcons name="fullscreen" size={18} color="#fff" />
        </View>
      </TouchableOpacity>

      <Modal
        visible={fullscreen}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreen(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.96)" }}>
          {/* Pinch-to-zoom on iOS via ScrollView zoom */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              flexGrow: 1,
              alignItems: "center",
              justifyContent: "center",
            }}
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => setFullscreen(false)}
              style={{ width: SCREEN_W, height: SCREEN_H, alignItems: "center", justifyContent: "center" }}
            >
              <Image
                source={{ uri }}
                style={{ width: SCREEN_W, height: SCREEN_H }}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </ScrollView>

          <TouchableOpacity
            onPress={() => setFullscreen(false)}
            hitSlop={10}
            style={{
              position: "absolute",
              top: 50,
              right: 20,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.15)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialCommunityIcons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

export default function MessageBubble({
  message,
  showAvatar = true,
  showTime = true,
}: MessageBubbleProps) {
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
        maxWidth: "80%",
        marginBottom: showTime ? 12 : 3,
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
            backgroundColor: BRAND.blue,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="store" size={14} color="#fff" />
        </View>
      )}
      {!isUser && !showAvatar && <View style={{ width: 28 }} />}

      <View style={{ alignItems: isUser ? "flex-end" : "flex-start" }}>
        {/* Attachments */}
        {attachments.map((att, i) => (
          <View key={`${att.url}-${i}`} style={{ marginBottom: 6 }}>
            {att.type === "video" ? (
              <VideoAttachment uri={att.url} />
            ) : (
              <ImageAttachment uri={att.url} />
            )}
          </View>
        ))}

        {/* Text bubble — corners nest so a run reads as one block */}
        {hasText && (
          <View
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              backgroundColor: isUser ? BRAND.blue : COLORS.surfaceContainerLowest,
              borderTopLeftRadius: !isUser && !showAvatar ? 6 : 16,
              borderTopRightRadius: isUser && !showAvatar ? 6 : 16,
              borderBottomLeftRadius: isUser ? 16 : showTime ? 4 : 6,
              borderBottomRightRadius: isUser ? (showTime ? 4 : 6) : 16,
              shadowColor: isUser ? "transparent" : "rgba(15,23,42,0.10)",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 1,
              shadowRadius: 8,
              elevation: isUser ? 0 : 1,
            }}
          >
            <Text
              style={{
                fontSize: 15,
                fontFamily: FONTS.body,
                color: isUser ? "#ffffff" : COLORS.onSurface,
                lineHeight: 22,
              }}
            >
              {message.content}
            </Text>
          </View>
        )}

        {showTime && (
          <Text
            style={{
              fontSize: 10,
              fontFamily: FONTS.body,
              color: COLORS.outline,
              marginTop: 4,
              textAlign: isUser ? "right" : "left",
              marginLeft: isUser ? 0 : 2,
              marginRight: isUser ? 2 : 0,
            }}
          >
            {time}
          </Text>
        )}
      </View>
    </View>
  );
}
