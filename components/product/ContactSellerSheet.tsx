import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Icon from "../ui/Icon";
import { COLORS } from "../../lib/constants";
import { getProductImage } from "../../lib/mock-data";
import { priceTagLabel } from "../../lib/pricing";
import type { Product } from "../../lib/types";
import { useStartConversation } from "../../features/messaging/hooks";
import { useAuthStore } from "../../features/auth/store";

/**
 * Bottom sheet letting a customer ask the support team a question about a
 * product. Sending opens a new conversation (with the product attached) and
 * navigates to the thread; the admin then receives the message with the
 * product card.
 */
export default function ContactSellerSheet({
  product,
  visible,
  onClose,
}: {
  product: Product;
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const start = useStartConversation();
  const [text, setText] = useState("");

  const img = getProductImage(product.images[0]);

  const handleSend = () => {
    const message = text.trim();
    if (!message) return;

    if (!isAuthenticated) {
      onClose();
      Alert.alert(
        "Connexion requise",
        "Connectez-vous pour contacter le service client.",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Se connecter", onPress: () => router.push("/(auth)/login") },
        ],
      );
      return;
    }

    Haptics.selectionAsync();
    start.mutate(
      { productId: product.id, message },
      {
        onSuccess: (conversation) => {
          setText("");
          onClose();
          router.push(`/(main)/messages/${conversation.id}`);
        },
        onError: () => {
          Alert.alert(
            "Erreur",
            "Votre message n'a pas pu être envoyé. Veuillez réessayer.",
          );
        },
      },
    );
  };

  const canSend = text.trim().length > 0 && !start.isPending;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end",
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
              paddingBottom: 34,
              gap: 16,
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontFamily: "Manrope_800ExtraBold",
                  color: COLORS.onSurface,
                }}
              >
                Poser une question
              </Text>
              <TouchableOpacity onPress={onClose} hitSlop={8}>
                <Icon name="close" size={22} color={COLORS.onSurface} />
              </TouchableOpacity>
            </View>

            {/* Product card */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                backgroundColor: COLORS.surfaceContainerLow,
                borderRadius: 12,
                padding: 10,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  overflow: "hidden",
                  backgroundColor: COLORS.surfaceContainer,
                }}
              >
                {img && (
                  <Image
                    source={img}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 13,
                    fontFamily: "Inter_600SemiBold",
                    color: COLORS.onSurface,
                  }}
                >
                  {product.name}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: "Manrope_700Bold",
                    color: COLORS.secondary,
                    marginTop: 2,
                  }}
                >
                  {priceTagLabel(product)}
                </Text>
              </View>
            </View>

            {/* Message input */}
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Votre question sur ce produit…"
              placeholderTextColor={COLORS.outline}
              multiline
              autoFocus
              style={{
                minHeight: 90,
                maxHeight: 160,
                borderRadius: 12,
                backgroundColor: COLORS.surfaceContainerLow,
                padding: 14,
                fontSize: 14,
                fontFamily: "Inter_400Regular",
                color: COLORS.onSurface,
                textAlignVertical: "top",
              }}
            />

            {/* Send */}
            <TouchableOpacity
              onPress={handleSend}
              disabled={!canSend}
              activeOpacity={0.9}
              style={{
                height: 50,
                borderRadius: 14,
                backgroundColor: canSend ? COLORS.primary : COLORS.outlineVariant,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 8,
              }}
            >
              {start.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Icon name="message-outline" size={18} color="#fff" />
                  <Text
                    style={{
                      fontSize: 15,
                      fontFamily: "Inter_700Bold",
                      color: "#fff",
                    }}
                  >
                    Envoyer au service client
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}
