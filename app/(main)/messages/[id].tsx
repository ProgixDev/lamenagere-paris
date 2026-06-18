import React, { useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../../lib/constants";
import { priceTagLabel } from "../../../lib/pricing";
import MessageBubble from "../../../components/messaging/MessageBubble";
import MessageInput from "../../../components/messaging/MessageInput";
import { getProductImage } from "../../../lib/mock-data";
import {
  useConversations,
  useConversationThread,
  useSendMessage,
  useMarkAsRead,
} from "../../../features/messaging/hooks";

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  const { data: conversations } = useConversations();
  const conversation = conversations?.find((c) => c.id === id);

  const { data: messages = [], isLoading: messagesLoading } =
    useConversationThread(id);
  const sendMessage = useSendMessage();
  const markAsRead = useMarkAsRead();

  const productImg = conversation?.product?.images[0]
    ? getProductImage(conversation.product.images[0])
    : null;

  useEffect(() => {
    if (id) markAsRead.mutate(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 150);
  }, []);

  const handleSend = useCallback(
    (content: string) => {
      if (!id) return;
      sendMessage.mutate(
        { conversationId: id, content },
        {
          onSuccess: () => {
            setTimeout(
              () => scrollRef.current?.scrollToEnd({ animated: true }),
              100,
            );
          },
          onError: () => {
            Alert.alert(
              "Erreur",
              "Votre message n'a pas pu être envoyé. Veuillez réessayer.",
            );
          },
        },
      );
    },
    [id, sendMessage],
  );

  if (!conversation) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: COLORS.onSurfaceVariant }}>
          Conversation introuvable
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f5f5" }} edges={["top"]}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 10,
          backgroundColor: "#ffffff",
          borderBottomWidth: 1,
          borderBottomColor: "#f0f0f0",
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={COLORS.onSurface} />
        </TouchableOpacity>

        {/* Vendor avatar */}
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
          <MaterialCommunityIcons name="store" size={18} color="#fff" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: COLORS.onSurface }}>
            {conversation.vendorName}
          </Text>
          <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: COLORS.outline }}>
            Répond généralement en 2h
          </Text>
        </View>

        <TouchableOpacity>
          <MaterialCommunityIcons name="phone-outline" size={22} color={COLORS.onSurface} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {/* Product context card */}
          {conversation.product && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => router.push(`/(main)/products/${conversation.product!.id}`)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: "#ffffff",
                borderRadius: 12,
                padding: 10,
                marginBottom: 16,
                alignSelf: "center",
                maxWidth: "90%",
                shadowColor: "rgba(0,0,0,0.04)",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 1,
                shadowRadius: 8,
                elevation: 1,
              }}
            >
              {productImg && (
                <Image
                  source={productImg}
                  style={{ width: 44, height: 44, borderRadius: 8 }}
                  resizeMode="cover"
                />
              )}
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: COLORS.onSurface }}
                  numberOfLines={1}
                >
                  {conversation.product.name}
                </Text>
                <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: COLORS.secondary }}>
                  {priceTagLabel(conversation.product)}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.outline} />
            </TouchableOpacity>
          )}

          {/* Messages */}
          {messagesLoading && messages.length === 0 ? (
            <View style={{ alignItems: "center", justifyContent: "center", paddingTop: 60 }}>
              <ActivityIndicator color={COLORS.secondary} />
            </View>
          ) : (
            messages.map((msg, idx) => {
              const prevMsg = idx > 0 ? messages[idx - 1] : null;
              const showAvatar = !prevMsg || prevMsg.sender !== msg.sender;
              return (
                <MessageBubble key={msg.id} message={msg} showAvatar={showAvatar} />
              );
            })
          )}
        </ScrollView>

        {/* Input */}
        <SafeAreaView edges={["bottom"]} style={{ backgroundColor: "#ffffff" }}>
          <MessageInput onSend={handleSend} disabled={sendMessage.isPending} />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
