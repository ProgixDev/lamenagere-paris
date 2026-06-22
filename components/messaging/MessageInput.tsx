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
import { COLORS } from "../../lib/constants";
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
        backgroundColor: "#ffffff",
        borderTopWidth: 1,
        borderTopColor: "#f0f0f0",
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
                  <MaterialCommunityIcons name="play-circle" size={26} color={COLORS.primary} />
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
              <ActivityIndicator size="small" color={COLORS.primary} />
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
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: "#f5f5f5",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialCommunityIcons name="plus" size={20} color={COLORS.outline} />
        </TouchableOpacity>

        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "flex-end",
            backgroundColor: "#f5f5f5",
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingVertical: 8,
            minHeight: 38,
            maxHeight: 100,
          }}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Écrire un message..."
            placeholderTextColor={COLORS.surfaceDim}
            style={{
              flex: 1,
              fontSize: 14,
              color: COLORS.onSurface,
              fontFamily: "Inter_400Regular",
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
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: canSend ? COLORS.primary : "#f5f5f5",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MaterialCommunityIcons
            name="send"
            size={18}
            color={canSend ? "#ffffff" : COLORS.surfaceDim}
            style={{ marginLeft: 2 }}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
