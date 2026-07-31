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
import Icon from "../../../components/ui/Icon";
import { COLORS, BRAND } from "../../../lib/constants";
import { FONTS, SPACE } from "../../../lib/typography";
import { priceTagLabel } from "../../../lib/pricing";
import MessageBubble from "../../../components/messaging/MessageBubble";
import MessageInput from "../../../components/messaging/MessageInput";
import {
  useConversations,
  useConversationThread,
  useSendMessage,
  useMarkAsRead,
} from "../../../features/messaging/hooks";
import GuestGate from "../../../components/GuestGate";
import { useIsGuestVisitor } from "../../../features/auth/guards";
import { productCoverSource } from "../../../lib/product-media";

/** Messages more than this far apart start a new run (fresh avatar + time). */
const RUN_GAP_MS = 5 * 60 * 1000;

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** "Aujourd'hui" / "Hier" / "12 juillet" — the year only when it isn't this one. */
function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (sameDay(date, today)) return "Aujourd’hui";
  if (sameDay(date, yesterday)) return "Hier";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    ...(date.getFullYear() === today.getFullYear() ? {} : { year: "numeric" }),
  }).format(date);
}

/** Centred small-caps date, held between two hairlines. */
function DaySeparator({ label }: { label: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: SPACE.md,
        marginTop: SPACE.lg,
        marginBottom: SPACE.lg,
        paddingHorizontal: SPACE.sm,
      }}
    >
      <View style={{ flex: 1, height: 1, backgroundColor: COLORS.outlineVariant }} />
      <Text
        style={{
          fontSize: 10,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          fontFamily: FONTS.bodySemibold,
          color: COLORS.outline,
        }}
      >
        {label}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: COLORS.outlineVariant }} />
    </View>
  );
}

function ConversationScreenContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  const { data: conversations } = useConversations();
  const conversation = conversations?.find((c) => c.id === id);

  const { data: messages = [], isLoading: messagesLoading } =
    useConversationThread(id);
  const sendMessage = useSendMessage();
  const markAsRead = useMarkAsRead();

  const productImg = productCoverSource(conversation?.product);

  useEffect(() => {
    if (id) markAsRead.mutate(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 150);
  }, []);

  const handleSend = useCallback(
    (content: string, attachments?: { url: string; type: "image" | "video" }[]) => {
      if (!id) return;
      sendMessage.mutate(
        {
          conversationId: id,
          content,
          attachments: attachments?.map((a) => a.url),
        },
        {
          onSuccess: () => {
            setTimeout(
              () => scrollRef.current?.scrollToEnd({ animated: true }),
              100,
            );
          },
          onError: () => {
            Alert.alert(
              "Message non envoyé",
              "Vérifiez votre connexion, puis renvoyez-le.",
            );
          },
        },
      );
    },
    [id, sendMessage],
  );

  if (!conversation) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 }}>
        <Text style={{ fontFamily: FONTS.serif, fontSize: 22, color: COLORS.onSurface, marginBottom: 8, textAlign: "center" }}>
          Conversation introuvable
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 21, fontFamily: FONTS.body, color: COLORS.outline, textAlign: "center" }}>
          Cet échange n’est plus disponible.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={["top"]}>
      {/* Header — who you're writing to, and what about */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: SPACE.md,
          paddingLeft: SPACE.sm,
          paddingRight: SPACE.lg,
          paddingVertical: SPACE.md,
          backgroundColor: COLORS.surfaceContainerLowest,
          // The product strip below carries the rule when there is one.
          borderBottomWidth: conversation.product ? 0 : 1,
          borderBottomColor: COLORS.outlineVariant,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          style={{ padding: SPACE.xs }}
        >
          <Icon name="chevron-left" size={26} color={COLORS.onSurface} />
        </TouchableOpacity>

        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            backgroundColor: BRAND.blue,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="store" size={18} color="#fff" />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
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
            style={{ fontFamily: FONTS.serifBold, fontSize: 20, lineHeight: 24, color: COLORS.onSurface }}
            numberOfLines={1}
          >
            {conversation.subject}
          </Text>
        </View>
      </View>

      {/*
        Signature: the piece under discussion is pinned below the header, so the
        reason for the conversation never scrolls out of reach. Its price stays
        brand blue, as everywhere else in the catalogue.
      */}
      {conversation.product && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push(`/(main)/products/${conversation.product!.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`Voir la fiche de ${conversation.product.name}`}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: SPACE.md,
            paddingHorizontal: SPACE.lg,
            paddingVertical: 10,
            backgroundColor: COLORS.surfaceContainerLowest,
            borderTopWidth: 1,
            borderTopColor: COLORS.outlineVariant,
            borderBottomWidth: 1,
            borderBottomColor: COLORS.outlineVariant,
          }}
        >
          {productImg ? (
            <Image
              source={productImg}
              style={{ width: 40, height: 40, borderRadius: 10 }}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: COLORS.surfaceContainer,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="image-off-outline" size={18} color={COLORS.surfaceDim} />
            </View>
          )}

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{ fontSize: 13, fontFamily: FONTS.bodyMedium, color: COLORS.onSurface }}
              numberOfLines={1}
            >
              {conversation.product.name}
            </Text>
            <Text style={{ fontSize: 15, fontFamily: FONTS.serif, color: BRAND.blue, marginTop: 1 }}>
              {priceTagLabel(conversation.product)}
            </Text>
          </View>

          <Icon name="chevron-right" size={18} color={COLORS.outline} />
        </TouchableOpacity>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: SPACE.lg, paddingTop: SPACE.xs, paddingBottom: SPACE.md }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messagesLoading && messages.length === 0 ? (
            <View style={{ alignItems: "center", justifyContent: "center", paddingTop: 60 }}>
              <ActivityIndicator color={BRAND.blue} />
            </View>
          ) : (
            messages.map((msg, idx) => {
              const prev = idx > 0 ? messages[idx - 1] : null;
              const next = idx < messages.length - 1 ? messages[idx + 1] : null;

              const at = new Date(msg.createdAt).getTime();
              const startsRun =
                !prev ||
                prev.sender !== msg.sender ||
                at - new Date(prev.createdAt).getTime() > RUN_GAP_MS;
              const endsRun =
                !next ||
                next.sender !== msg.sender ||
                new Date(next.createdAt).getTime() - at > RUN_GAP_MS;

              const newDay =
                !prev || !sameDay(new Date(prev.createdAt), new Date(msg.createdAt));

              return (
                <React.Fragment key={msg.id}>
                  {newDay && <DaySeparator label={dayLabel(msg.createdAt)} />}
                  <MessageBubble
                    message={msg}
                    showAvatar={startsRun}
                    showTime={endsRun}
                  />
                </React.Fragment>
              );
            })
          )}
        </ScrollView>

        {/* Composer */}
        <SafeAreaView edges={["bottom"]} style={{ backgroundColor: COLORS.surfaceContainerLowest }}>
          <MessageInput onSend={handleSend} disabled={sendMessage.isPending} />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Guests may browse the catalogue freely, but this screen holds personal
 * account data — show the sign-in prompt instead of firing authenticated
 * requests that would fail.
 */
export default function ConversationScreen() {
  const isGuestVisitor = useIsGuestVisitor();
  if (isGuestVisitor) {
    return (
      <GuestGate
        icon="message-outline"
        title="Vos messages"
        message="Connectez-vous pour échanger avec notre équipe."
      />
    );
  }
  return <ConversationScreenContent />;
}
