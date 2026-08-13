import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Icon from "../../components/ui/Icon";
import EmptyState from "../../components/ui/EmptyState";
import { COLORS, BRAND } from "../../lib/constants";
import { FONTS, TYPE, SPACE } from "../../lib/typography";
import ConversationItem from "../../components/messaging/ConversationItem";
import { useConversations, useMarkAsRead } from "../../features/messaging/hooks";
import LogoHeader from "../../components/layout/LogoHeader";
import GuestGate from "../../components/GuestGate";
import Button from "../../components/ui/Button";
import { useAuthStore } from "../../features/auth/store";
import { useGuestStore } from "../../features/auth/guest";

export default function MessagesScreen() {
  const [search, setSearch] = useState("");
  const router = useRouter();

  const { data, isLoading } = useConversations();
  const conversations = data ?? [];
  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);
  const markAsRead = useMarkAsRead();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isGuest = useGuestStore((s) => s.isGuest);

  if (isGuest && !isAuthenticated) {
    return (
      <GuestGate
        icon="message-outline"
        title="Vos échanges"
        message="Connectez-vous pour contacter nos conseillers et suivre vos conversations."
      />
    );
  }

  const handleMarkAllRead = () => {
    conversations
      .filter((c) => c.unreadCount > 0)
      .forEach((c) => markAsRead.mutate(c.id));
  };

  const filtered = search
    ? conversations.filter(
        (c) =>
          c.vendorName.toLowerCase().includes(search.toLowerCase()) ||
          c.subject.toLowerCase().includes(search.toLowerCase()) ||
          c.lastMessage.toLowerCase().includes(search.toLowerCase()),
      )
    : conversations;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <LogoHeader />

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: SPACE.lg,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={TYPE.screenTitle}>Messages</Text>
          <Text
            style={{
              fontSize: 12,
              fontFamily: FONTS.body,
              color: totalUnread > 0 ? BRAND.blue : COLORS.outline,
              marginTop: 2,
            }}
          >
            {totalUnread > 0
              ? `${totalUnread} message${totalUnread > 1 ? "s" : ""} non lu${totalUnread > 1 ? "s" : ""}`
              : "Tout est lu"}
          </Text>
        </View>

        {totalUnread > 0 && (
          <TouchableOpacity
            onPress={handleMarkAllRead}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Tout marquer comme lu"
            style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 }}
          >
            <Icon name="check" size={14} color={BRAND.blue} />
            <Text style={{ fontSize: 12, fontFamily: FONTS.bodyMedium, color: BRAND.blue }}>
              Tout marquer lu
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search — a quiet inset field, so the cards below carry the elevation */}
      {conversations.length > 0 && (
        <View style={{ paddingHorizontal: 20, marginBottom: SPACE.lg }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: COLORS.surfaceContainer,
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 11,
              gap: 8,
            }}
          >
            <Icon name="magnify" size={18} color={COLORS.outline} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher un échange"
              placeholderTextColor={COLORS.outline}
              style={{
                flex: 1,
                fontSize: 14,
                fontFamily: FONTS.body,
                color: COLORS.onSurface,
                paddingVertical: 0,
              }}
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch("")}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Effacer la recherche"
              >
                <Icon name="close" size={16} color={COLORS.outline} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Conversations */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, gap: SPACE.md }}
      >
        {isLoading && conversations.length === 0 ? (
          <View style={{ alignItems: "center", justifyContent: "center", paddingTop: 100 }}>
            <ActivityIndicator color={BRAND.blue} />
          </View>
        ) : filtered.length > 0 ? (
          filtered.map((conv, idx) => (
            <Animated.View
              key={conv.id}
              entering={FadeInDown.delay(idx * 55).springify()}
            >
              <ConversationItem conversation={conv} />
            </Animated.View>
          ))
        ) : (
          <EmptyState
            art="messages"
            title={search ? "Aucun résultat" : "Aucun échange"}
            message={
              search
                ? "Essayez un autre nom ou un autre sujet."
                : "Une question sur une pièce ? Ouvrez sa fiche et écrivez-nous — l’échange se retrouvera ici."
            }
            action={
              search
                ? undefined
                : {
                    label: "Parcourir le catalogue",
                    onPress: () => router.push("/(tabs)/categories"),
                  }
            }
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
