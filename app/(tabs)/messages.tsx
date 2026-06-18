import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../lib/constants";
import ConversationItem from "../../components/messaging/ConversationItem";
import { useConversations, useMarkAsRead } from "../../features/messaging/hooks";
import LogoHeader from "../../components/layout/LogoHeader";

export default function MessagesScreen() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useConversations();
  const conversations = data ?? [];
  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);
  const markAsRead = useMarkAsRead();

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
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 12,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontSize: 20, fontFamily: "Manrope_700Bold", color: COLORS.onSurface }}>
            Messages
          </Text>
          {totalUnread > 0 && (
            <View
              style={{
                minWidth: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: COLORS.secondary,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 6,
              }}
            >
              <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff" }}>
                {totalUnread}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          onPress={handleMarkAllRead}
          disabled={totalUnread === 0}
          hitSlop={8}
        >
          <MaterialCommunityIcons
            name="email-check-outline"
            size={22}
            color={totalUnread === 0 ? COLORS.outlineVariant : COLORS.onSurface}
          />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#ffffff",
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            gap: 8,
          }}
        >
          <MaterialCommunityIcons name="magnify" size={18} color={COLORS.outline} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher une conversation..."
            placeholderTextColor={COLORS.surfaceDim}
            style={{
              flex: 1,
              fontSize: 13,
              fontFamily: "Inter_400Regular",
              color: COLORS.onSurface,
              paddingVertical: 0,
            }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <MaterialCommunityIcons name="close-circle" size={16} color={COLORS.outline} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Conversations */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {isLoading && conversations.length === 0 ? (
          <View style={{ alignItems: "center", justifyContent: "center", paddingTop: 100 }}>
            <ActivityIndicator color={COLORS.secondary} />
          </View>
        ) : filtered.length > 0 ? (
          filtered.map((conv, idx) => (
            <View key={conv.id}>
              <ConversationItem conversation={conv} />
              {idx < filtered.length - 1 && (
                <View style={{ height: 1, backgroundColor: "#f5f5f5", marginLeft: 82 }} />
              )}
            </View>
          ))
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, paddingHorizontal: 40 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: "#f0ebe6",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <MaterialCommunityIcons name="chat-outline" size={32} color={COLORS.secondary} />
            </View>
            <Text style={{ fontSize: 16, fontFamily: "Manrope_700Bold", color: COLORS.onSurface, marginBottom: 6 }}>
              {search ? "Aucun résultat" : "Aucune conversation"}
            </Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: COLORS.onSurfaceVariant, textAlign: "center" }}>
              {search
                ? "Essayez avec d'autres termes"
                : "Vos échanges avec nos artisans apparaîtront ici"}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
