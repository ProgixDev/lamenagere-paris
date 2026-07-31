import React, { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Icon from "../ui/Icon";
import { COLORS, BRAND } from "../../lib/constants";
import { FONTS } from "../../lib/typography";
import {
  pickMessageMedia,
  uploadMessageMedia,
  type Attachment,
} from "../../features/messaging/upload";

interface MessageInputProps {
  onSend: (message: string, attachments?: Attachment[]) => void;
  disabled?: boolean;
}

export default function MessageInput({ onSend, disabled = false }: MessageInputProps) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const handlePick = async () => {
    if (uploading || disabled) return;
    const asset = await pickMessageMedia();
    if (!asset) return;
    setUploading(true);
    try {
      const uploaded = await uploadMessageMedia(asset);
      setAttachments((prev) => [...prev, uploaded]);
    } catch {
      Alert.alert("Erreur", "L'envoi du fichier a échoué. Réessayez.");
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    const content = text.trim();
    if ((!content && attachments.length === 0) || uploading) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSend(content, attachments.length ? attachments : undefined);
    setText("");
    setAttachments([]);
  };

  const canSend =
    (text.trim().length > 0 || attachments.length > 0) && !disabled && !uploading;

  return (
    <View
      style={{
        backgroundColor: COLORS.surfaceContainerLowest,
        borderTopWidth: 1,
        borderTopColor: COLORS.outlineVariant,
      }}
    >
      {/* Pending attachment previews */}
      {(attachments.length > 0 || uploading) && (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            paddingHorizontal: 16,
            paddingTop: 10,
          }}
        >
          {attachments.map((att, i) => (
            <View key={`${att.url}-${i}`} style={{ width: 60, height: 60 }}>
              {att.type === "video" ? (
                <View
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 10,
                    backgroundColor: COLORS.surfaceContainer,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialCommunityIcons name="play-circle" size={26} color={BRAND.blue} />
                </View>
              ) : (
                <Image
                  source={{ uri: att.url }}
                  style={{ width: 60, height: 60, borderRadius: 10 }}
                  resizeMode="cover"
                />
              )}
              <TouchableOpacity
                onPress={() =>
                  setAttachments((prev) => prev.filter((_, idx) => idx !== i))
                }
                hitSlop={6}
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: COLORS.onSurface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialCommunityIcons name="close" size={12} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
          {uploading && (
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 10,
                backgroundColor: COLORS.surfaceContainer,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator size="small" color={BRAND.blue} />
            </View>
          )}
        </View>
      )}

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 10,
          paddingHorizontal: 16,
          paddingVertical: 10,
        }}
      >
        <TouchableOpacity
          onPress={handlePick}
          disabled={uploading || disabled}
          accessibilityRole="button"
          accessibilityLabel="Joindre une photo ou une vidéo"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: COLORS.surfaceContainer,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="paperclip" size={19} color={COLORS.onSurfaceVariant} />
        </TouchableOpacity>

        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "flex-end",
            backgroundColor: COLORS.surfaceContainer,
            borderRadius: 20,
            paddingHorizontal: 15,
            paddingVertical: 10,
            minHeight: 40,
            maxHeight: 110,
          }}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Écrire un message"
            placeholderTextColor={COLORS.outline}
            style={{
              flex: 1,
              fontSize: 15,
              color: COLORS.onSurface,
              fontFamily: FONTS.body,
              lineHeight: 20,
              paddingVertical: 0,
            }}
            multiline
            editable={!disabled}
          />
        </View>

        <TouchableOpacity
          onPress={handleSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Envoyer"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: canSend ? BRAND.blue : COLORS.surfaceContainer,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon
            name="send"
            size={18}
            color={canSend ? "#ffffff" : COLORS.surfaceDim}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
