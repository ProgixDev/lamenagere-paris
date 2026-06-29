import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as Haptics from "expo-haptics";
import Icon from "../ui/Icon";
import Button from "../ui/Button";
import { COLORS } from "../../lib/constants";
import { useCreateQuote } from "../../features/quotes/hooks";
import {
  pickMessageMedia,
  uploadMessageMedia,
  type Attachment,
} from "../../features/messaging/upload";

interface Props {
  productId: string;
  productName: string;
  visible: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}

export default function DevisRequestSheet({
  productId,
  productName,
  visible,
  onClose,
  onSubmitted,
}: Props) {
  const createQuote = useCreateQuote();
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const reset = () => {
    setNotes("");
    setAttachments([]);
  };

  const pick = async () => {
    if (uploading) return;
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

  const submit = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    createQuote.mutate(
      {
        productId,
        notes: notes.trim() || undefined,
        images: attachments.length ? attachments.map((a) => a.url) : undefined,
      },
      {
        onSuccess: () => {
          reset();
          onClose();
          onSubmitted?.();
        },
        onError: (e: any) =>
          Alert.alert(
            "Erreur",
            e?.response?.data?.message || e?.message || "Impossible d'envoyer la demande de devis",
          ),
      },
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: COLORS.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ fontSize: 17, fontFamily: "Manrope_800ExtraBold", color: COLORS.onSurface }}>
              Demander un devis
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Icon name="close" size={22} color={COLORS.outline} />
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: COLORS.outline, marginBottom: 16 }}>
            Décrivez votre projet pour {productName}. Notre équipe vous enverra un prix personnalisé.
          </Text>

          <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 14, minHeight: 100, marginBottom: 12 }}>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Vos besoins : dimensions, finitions, contraintes…"
              placeholderTextColor={COLORS.surfaceDim}
              multiline
              style={{
                fontSize: 14,
                color: COLORS.onSurface,
                fontFamily: "Inter_400Regular",
                lineHeight: 20,
                textAlignVertical: "top",
                minHeight: 72,
              }}
            />
          </View>

          {/* Photos */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {attachments.map((att, i) => (
              <View key={`${att.url}-${i}`} style={{ width: 60, height: 60 }}>
                {att.type === "video" ? (
                  <View style={{ width: 60, height: 60, borderRadius: 10, backgroundColor: COLORS.surfaceContainer, alignItems: "center", justifyContent: "center" }}>
                    <Icon name="play-circle" size={24} color={COLORS.primary} />
                  </View>
                ) : (
                  <Image source={{ uri: att.url }} style={{ width: 60, height: 60, borderRadius: 10 }} resizeMode="cover" />
                )}
                <TouchableOpacity
                  onPress={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                  hitSlop={6}
                  style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.onSurface, alignItems: "center", justifyContent: "center" }}
                >
                  <Icon name="close" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              onPress={pick}
              disabled={uploading}
              style={{ width: 60, height: 60, borderRadius: 10, borderWidth: 1, borderColor: COLORS.outlineVariant, borderStyle: "dashed", alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surfaceContainerLow }}
            >
              {uploading ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Icon name="camera-plus-outline" size={22} color={COLORS.outline} />}
            </TouchableOpacity>
          </View>

          <Button
            label="Envoyer la demande"
            onPress={submit}
            loading={createQuote.isPending}
            disabled={uploading}
            size="lg"
          />
        </View>
      </View>
    </Modal>
  );
}
