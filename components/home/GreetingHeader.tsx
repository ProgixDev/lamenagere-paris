import React, { useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import Icon from "../ui/Icon";
import { COLORS } from "../../lib/constants";
import { FONTS } from "../../lib/typography";
import { useAuthStore } from "../../features/auth/store";
import { useNotifInboxStore, selectUnreadCount } from "../../features/notifications/inbox";

// Creative, time-aware greetings (French). One is picked at random within the
// current slot each time the home mounts, so it feels alive without flickering
// on re-render.
const GREETINGS: { from: number; to: number; lines: string[] }[] = [
  { from: 5, to: 8, lines: ["Le soleil se lève ☀️", "Déjà debout ? Bravo 👏", "Bonjour, lève-tôt 🐦"] },
  { from: 8, to: 12, lines: ["Bonjour 👋", "Belle matinée ✨", "Prêt pour aujourd'hui ?"] },
  { from: 12, to: 14, lines: ["Bon appétit 🍽️", "L'heure de la pause ?", "Un petit plaisir à midi ?"] },
  { from: 14, to: 18, lines: ["Bon après-midi ☀️", "L'après-midi vous va bien", "Envie de nouveautés ?"] },
  { from: 18, to: 22, lines: ["Bonsoir 🌙", "Bonne soirée ✨", "Détendez-vous, on s'occupe du reste"] },
  // Night wraps midnight (22 → 5)
  { from: 22, to: 5, lines: ["Bonne nuit ✨", "Encore debout ? 🌙", "Les meilleures idées viennent la nuit"] },
];

function pickGreeting() {
  const h = new Date().getHours();
  const slot =
    GREETINGS.find((g) =>
      g.from <= g.to ? h >= g.from && h < g.to : h >= g.from || h < g.to,
    ) ?? GREETINGS[1];
  const i = Math.floor(Math.random() * slot.lines.length);
  return slot.lines[i];
}

/**
 * Personalised home header row: a creative, time-of-day greeting and the
 * customer's name on the left; bare notification and favourites icons on the
 * right. Sits directly under the brand logo. (No avatar.)
 */
export default function GreetingHeader() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const unread = useNotifInboxStore(selectUnreadCount);
  const greeting = useMemo(() => pickGreeting(), []);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingTop: 4,
        paddingBottom: 12,
      }}
    >
      {/* Greeting + name */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.outline }}>
          {greeting}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontFamily: FONTS.serif, fontSize: 27, lineHeight: 31, color: COLORS.onSurface, marginTop: 2 }}
        >
          {user?.fullName || "Bienvenue"}
        </Text>
      </View>

      {/* Bare action icons */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 18, paddingLeft: 12 }}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push("/(main)/notifications")}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          hitSlop={8}
        >
          <Icon name="bell-outline" size={25} color={COLORS.onSurface} />
          {unread > 0 && (
            <View
              style={{
                position: "absolute",
                top: -3,
                right: -3,
                minWidth: 16,
                height: 16,
                paddingHorizontal: 3,
                borderRadius: 8,
                backgroundColor: COLORS.primary,
                borderWidth: 1.5,
                borderColor: COLORS.background,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 9, fontFamily: FONTS.bodyBold, color: "#fff" }}>
                {unread > 9 ? "9+" : unread}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push("/(main)/favorites")}
          accessibilityRole="button"
          accessibilityLabel="Favoris"
          hitSlop={8}
        >
          <Icon name="heart-outline" size={25} color={COLORS.onSurface} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
