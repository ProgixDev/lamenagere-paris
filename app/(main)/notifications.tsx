import React, { useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Icon from "../../components/ui/Icon";
import { COLORS } from "../../lib/constants";
import { FONTS, TYPE, SHADOW } from "../../lib/typography";
import { buildDeepLinkFromTarget } from "../../lib/notifications";
import { useNotifInboxStore, type InboxItem } from "../../features/notifications/inbox";

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `Il y a ${d} j`;
  return new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// Pick an evocative icon per notification target.
function iconFor(item: InboxItem): string {
  switch (item.target?.kind) {
    case "product":
      return "package";
    case "category":
      return "view-grid";
    default:
      return "bell";
  }
}

export default function NotificationsScreen() {
  const router = useRouter();
  const items = useNotifInboxStore((s) => s.items);
  const markRead = useNotifInboxStore((s) => s.markRead);
  const markAllRead = useNotifInboxStore((s) => s.markAllRead);
  const clear = useNotifInboxStore((s) => s.clear);

  const hasUnread = items.some((i) => !i.read);

  // Opening the inbox clears the unread badge (standard inbox behaviour).
  useEffect(() => {
    const t = setTimeout(() => markAllRead(), 600);
    return () => clearTimeout(t);
  }, [markAllRead]);

  const onPressItem = (item: InboxItem) => {
    Haptics.selectionAsync();
    markRead(item.id);
    if (item.target) router.push(buildDeepLinkFromTarget(item.target) as any);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 12,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} accessibilityLabel="Retour">
          <Icon name="chevron-left" size={26} color={COLORS.onSurface} />
        </TouchableOpacity>
        <Text style={[TYPE.screenTitle]}>Notifications</Text>
        <View style={{ flex: 1 }} />
        {items.length > 0 && (
          <TouchableOpacity onPress={() => clear()} hitSlop={8}>
            <Text style={{ fontSize: 12, fontFamily: FONTS.bodySemibold, color: COLORS.primary }}>
              Effacer
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {items.length > 0 ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40, gap: 12 }}
        >
          {items.map((item, idx) => (
            <Animated.View key={item.id} entering={FadeInDown.delay(Math.min(idx, 10) * 40).springify().damping(18)}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => onPressItem(item)}
                style={{
                  flexDirection: "row",
                  gap: 14,
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: COLORS.surfaceContainerLowest,
                  ...SHADOW.soft,
                }}
              >
                {/* Icon tile */}
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 14,
                    backgroundColor: item.read ? COLORS.surfaceContainer : COLORS.primary + "12",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name={iconFor(item)} size={20} color={COLORS.primary} />
                </View>

                {/* Body */}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text
                      style={{ flex: 1, fontSize: 15, fontFamily: item.read ? FONTS.bodyMedium : FONTS.bodySemibold, color: COLORS.onSurface }}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    {!item.read && (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary }} />
                    )}
                  </View>
                  {!!item.body && (
                    <Text
                      style={{
                        fontSize: 13,
                        lineHeight: 19,
                        fontFamily: FONTS.body,
                        color: COLORS.onSurfaceVariant,
                        marginTop: 3,
                      }}
                      numberOfLines={2}
                    >
                      {item.body}
                    </Text>
                  )}
                  <Text
                    style={{ fontSize: 11, fontFamily: FONTS.body, color: COLORS.outline, marginTop: 6 }}
                  >
                    {relativeTime(item.receivedAt)}
                  </Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: COLORS.surfaceContainer,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <Icon name="bell-outline" size={32} color={COLORS.outline} />
          </View>
          <Text style={{ fontFamily: FONTS.serif, fontSize: 22, color: COLORS.onSurface, marginBottom: 8, textAlign: "center" }}>
            Aucune notification
          </Text>
          <Text
            style={{
              fontSize: 14,
              lineHeight: 21,
              fontFamily: FONTS.body,
              color: COLORS.outline,
              textAlign: "center",
            }}
          >
            Vos offres, nouveautés et suivis de commande{"\n"}apparaîtront ici.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}
