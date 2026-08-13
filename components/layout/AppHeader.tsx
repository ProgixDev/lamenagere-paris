import React, { useMemo } from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import Icon from "../ui/Icon";
import SearchBar from "../SearchBar";
import { COLORS } from "../../lib/constants";
import { FONTS } from "../../lib/typography";
import { useAuthStore } from "../../features/auth/store";
import {
  useNotifInboxStore,
  selectUnreadCount,
} from "../../features/notifications/inbox";

// Creative, time-aware greetings (French). One is picked at random within the
// current slot each time the header mounts, so it feels alive without
// flickering on re-render.
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
  return slot.lines[Math.floor(Math.random() * slot.lines.length)];
}

/** Bell (with unread badge) and favourites — the app's two persistent shortcuts. */
function HeaderActions() {
  const router = useRouter();
  const unread = useNotifInboxStore(selectUnreadCount);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 18, paddingLeft: 12 }}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push("/(main)/notifications")}
        accessibilityRole="button"
        accessibilityLabel={
          unread > 0 ? `Notifications, ${unread} non lues` : "Notifications"
        }
        hitSlop={10}
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
        hitSlop={10}
      >
        <Icon name="heart-outline" size={25} color={COLORS.onSurface} />
      </TouchableOpacity>
    </View>
  );
}

/**
 * The app's masthead: logo, notifications, favourites and search.
 *
 * It used to be assembled by hand on the home screen only, so Categories had no
 * bell or heart and a single category had neither logo nor search — the same
 * product looked like three different apps depending on the route.
 */
export default function AppHeader({
  greeting = false,
  title,
  subtitle,
  search = true,
  searchPlaceholder,
  onFilterPress,
  filterActive = false,
  onBack,
}: {
  /** Show the time-of-day greeting and the customer's name. Home only. */
  greeting?: boolean;
  /** Shown instead of the greeting — a section or category name. */
  title?: string;
  subtitle?: string;
  search?: boolean;
  searchPlaceholder?: string;
  onFilterPress?: () => void;
  filterActive?: boolean;
  /** Adds a back chevron beside the logo, for screens pushed on the stack. */
  onBack?: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const line = useMemo(() => (greeting ? pickGreeting() : null), [greeting]);
  const hasLeft = greeting || !!title;

  return (
    <View>
      <View style={{ alignItems: "center", paddingTop: 8, paddingBottom: 6 }}>
        <Image
          source={require("../../assets/images/logo.png")}
          style={{ width: 200, height: 60, resizeMode: "contain" }}
          accessibilityLabel="La Ménagère Paris"
        />
        {onBack && (
          <TouchableOpacity
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Retour"
            style={{ position: "absolute", left: 12, top: 20 }}
          >
            <Icon name="chevron-left" size={28} color={COLORS.onSurface} />
          </TouchableOpacity>
        )}
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          {hasLeft && (
            <>
              <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.outline }}>
                {greeting ? line : subtitle}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: FONTS.serif,
                  fontSize: 27,
                  lineHeight: 31,
                  color: COLORS.onSurface,
                  marginTop: 2,
                }}
              >
                {greeting ? user?.fullName || "Bienvenue" : title}
              </Text>
            </>
          )}
        </View>
        <HeaderActions />
      </View>

      {search && (
        <SearchBar
          placeholder={searchPlaceholder}
          onFilterPress={onFilterPress}
          filterActive={filterActive}
        />
      )}
    </View>
  );
}
