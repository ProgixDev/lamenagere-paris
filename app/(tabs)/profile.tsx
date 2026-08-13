import React from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "../../components/ui/Icon";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, BRAND } from "../../lib/constants";
import { FONTS, TYPE, SPACE, SHADOW } from "../../lib/typography";
import { useAuthStore } from "../../features/auth/store";
import { useGuestStore } from "../../features/auth/guest";
import { getNameInitials } from "../../lib/utils";
import LogoHeader from "../../components/layout/LogoHeader";
import GuestGate from "../../components/GuestGate";
import PressableScale from "../../components/ui/PressableScale";
import { useOrders } from "../../features/orders/hooks";
import { useQuoteRequests } from "../../features/quotes/hooks";
import { useFavoritesStore } from "../../features/favorites/store";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";

/**
 * The customer's own space — identity and activity, nothing else.
 *
 * This screen used to be three stacks of identical grey rows, half of which
 * were settings ("Paramètres", "À propos", legal-adjacent help) and one of
 * which was a red-tinted logout block. All of that now lives in
 * app/(main)/settings.tsx, reachable from the gear in this screen's header.
 *
 * What's left is what a profile is for: who you are (navy masthead + monogram),
 * what you've done (live counters), and where to go next (activity cards).
 */

/** "mars 2024" — the signup month, shown as a quiet loyalty cue. */
function memberSince(createdAt?: string): string | null {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { data: orders = [], isPending: ordersPending } = useOrders();
  const { data: quotes = [], isPending: quotesPending } = useQuoteRequests();
  const favoriteCount = useFavoritesStore((s) => s.favorites.length);
  const isGuest = useGuestStore((s) => s.isGuest);
  const reduceMotion = useReducedMotion();

  if (isGuest && !isAuthenticated) {
    return (
      <GuestGate
        icon="account-outline"
        title="Votre espace personnel"
        message="Connectez-vous ou créez un compte pour accéder à votre profil, vos commandes et vos favoris."
      />
    );
  }

  const initials = user ? getNameInitials(user.fullName) : "?";
  const since = memberSince(user?.createdAt);
  const addressCount = user?.addresses?.length ?? 0;

  // Headline figures are lifetime totals; the captions on the activity cards
  // carry the "needs your attention" numbers so a count always means one thing.
  const openOrders = orders.filter((o) => o.status !== "livree").length;
  const readyQuotes = quotes.filter((q) => q.status === "devis_envoye").length;

  const stats: { label: string; value: string; route: string }[] = [
    {
      label: "Commandes",
      value: ordersPending ? "—" : String(orders.length),
      route: "/(main)/orders",
    },
    {
      label: "Devis",
      value: quotesPending ? "—" : String(quotes.length),
      route: "/(main)/orders?tab=quotes",
    },
    { label: "Favoris", value: String(favoriteCount), route: "/(main)/favorites" },
  ];

  const activity: {
    icon: string;
    label: string;
    caption: string;
    live: boolean;
    route: string;
  }[] = [
    {
      icon: "shopping-outline",
      label: "Mes commandes",
      caption: openOrders > 0 ? `${openOrders} en cours` : "Tout est livré",
      live: openOrders > 0,
      route: "/(main)/orders",
    },
    {
      icon: "file-document-outline",
      label: "Mes devis",
      caption: readyQuotes > 0 ? `${readyQuotes} à consulter` : "Aucun en attente",
      live: readyQuotes > 0,
      route: "/(main)/orders?tab=quotes",
    },
    {
      icon: "heart-outline",
      label: "Mes favoris",
      caption:
        favoriteCount > 0
          ? `${favoriteCount} article${favoriteCount > 1 ? "s" : ""}`
          : "Rien de sauvegardé",
      live: favoriteCount > 0,
      route: "/(main)/favorites",
    },
    {
      icon: "map-marker-outline",
      label: "Mes adresses",
      caption:
        addressCount > 0
          ? `${addressCount} enregistrée${addressCount > 1 ? "s" : ""}`
          : "Ajouter une adresse",
      live: false,
      route: "/(main)/addresses",
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Masthead: shared logo, with settings pulled out of the row list and
          parked here as the single gear affordance. */}
      <View>
        <LogoHeader />
        <TouchableOpacity
          onPress={() => router.push("/(main)/settings")}
          hitSlop={14}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Paramètres"
          style={{ position: "absolute", right: 16, top: 26 }}
        >
          <Icon name="cog-outline" size={24} color={COLORS.onSurface} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
      >
        {/* ── Identity panel ─────────────────────────────────────────────
            A full-bleed navy block, not a floating card on empty space:
            the monogram plate is what makes this feel like a boutique
            account rather than a settings list. */}
        <LinearGradient
          colors={[COLORS.primaryContainer, COLORS.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: SPACE.xl,
            paddingBottom: 60,
            paddingHorizontal: 20,
            alignItems: "center",
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
          }}
        >
          <PressableScale
            onPress={() => router.push("/(main)/edit-profile")}
            accessibilityLabel="Modifier le profil"
          >
            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: 44,
                backgroundColor: "#ffffff",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: FONTS.serifBold,
                  fontSize: 34,
                  lineHeight: 40,
                  color: COLORS.primary,
                }}
              >
                {initials}
              </Text>
            </View>
            <View
              style={{
                position: "absolute",
                right: -2,
                bottom: -2,
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: COLORS.primary,
                borderWidth: 2,
                borderColor: "#ffffff",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="pencil-outline" size={14} color="#ffffff" />
            </View>
          </PressableScale>

          <Text
            numberOfLines={1}
            style={{
              fontFamily: FONTS.serif,
              fontSize: 28,
              lineHeight: 34,
              color: "#ffffff",
              marginTop: SPACE.lg,
            }}
          >
            {user?.fullName?.trim() ? user.fullName : "Utilisateur"}
          </Text>

          {!!user?.email && (
            <Text
              numberOfLines={1}
              style={{
                fontFamily: FONTS.body,
                fontSize: 13,
                color: "rgba(255,255,255,0.72)",
                marginTop: 3,
              }}
            >
              {user.email}
            </Text>
          )}

          {user?.accountType === "professionnel" && (
            <View
              style={{
                marginTop: SPACE.md,
                borderWidth: 1,
                borderColor: "rgba(254,193,3,0.55)",
                borderRadius: 9999,
                paddingHorizontal: 12,
                paddingVertical: 5,
              }}
            >
              <Text style={[TYPE.overline, { color: BRAND.yellow, fontSize: 10 }]}>
                Compte professionnel
              </Text>
            </View>
          )}

          {!!since && (
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 12,
                color: "rgba(255,255,255,0.62)",
                marginTop: SPACE.md,
              }}
            >
              Client depuis {since}
            </Text>
          )}
        </LinearGradient>

        {/* ── Counters ───────────────────────────────────────────────────
            Straddles the panel edge so the two halves read as one object. */}
        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.springify().damping(16)}
          style={{
            flexDirection: "row",
            marginHorizontal: 20,
            marginTop: -40,
            backgroundColor: COLORS.surfaceContainerLowest,
            borderRadius: 20,
            paddingVertical: SPACE.lg,
            ...SHADOW.card,
          }}
        >
          {stats.map((s, i) => (
            <React.Fragment key={s.label}>
              {i > 0 && (
                <View
                  style={{
                    width: 1,
                    alignSelf: "center",
                    height: 34,
                    backgroundColor: COLORS.outlineVariant,
                  }}
                />
              )}
              {/* PressableScale puts `style` on its inner Animated.View, so
                  the thirds have to be claimed by this wrapper — otherwise the
                  columns size to their text and clump to the left. */}
              <View style={{ flex: 1 }}>
                <PressableScale
                  onPress={() => router.push(s.route as never)}
                  scaleTo={0.96}
                  accessibilityLabel={`${s.label} : ${s.value}`}
                  style={{ alignItems: "center", paddingVertical: 2 }}
                >
                  <Text
                    style={{
                      fontFamily: FONTS.serifBold,
                      fontSize: 26,
                      lineHeight: 30,
                      color: COLORS.onSurface,
                    }}
                  >
                    {s.value}
                  </Text>
                  <Text
                    style={[
                      TYPE.overline,
                      { fontSize: 10, letterSpacing: 1.2, marginTop: 4, textAlign: "center" },
                    ]}
                  >
                    {s.label}
                  </Text>
                </PressableScale>
              </View>
            </React.Fragment>
          ))}
        </Animated.View>

        {/* ── Activity ───────────────────────────────────────────────────
            Two-up cards instead of a row list: bigger targets, and each one
            carries its own live caption so the screen is never blank. */}
        <Text
          style={[
            TYPE.overline,
            { paddingHorizontal: 20, marginTop: SPACE.xxl, marginBottom: SPACE.md },
          ]}
        >
          Mon activité
        </Text>

        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          {[activity.slice(0, 2), activity.slice(2, 4)].map((row, ri) => (
            <View key={ri} style={{ flexDirection: "row", gap: 12 }}>
              {row.map((item, ci) => (
                <Animated.View
                  key={item.label}
                  style={{ flex: 1 }}
                  entering={
                    reduceMotion
                      ? undefined
                      : FadeInDown.delay((ri * 2 + ci) * 50)
                          .springify()
                          .damping(16)
                  }
                >
                  <PressableScale
                    onPress={() => router.push(item.route as never)}
                    scaleTo={0.97}
                    accessibilityLabel={`${item.label}, ${item.caption}`}
                    style={{
                      backgroundColor: COLORS.surfaceContainerLowest,
                      borderRadius: 18,
                      padding: SPACE.lg,
                      minHeight: 116,
                      justifyContent: "space-between",
                      ...SHADOW.soft,
                    }}
                  >
                    <Icon name={item.icon} size={24} color={COLORS.primary} />
                    <View>
                      <Text
                        style={{
                          fontFamily: FONTS.bodyMedium,
                          fontSize: 14.5,
                          color: COLORS.onSurface,
                        }}
                      >
                        {item.label}
                      </Text>
                      <Text
                        style={{
                          fontFamily: item.live ? FONTS.bodyMedium : FONTS.body,
                          fontSize: 12,
                          color: item.live ? BRAND.blue : COLORS.outline,
                          marginTop: 3,
                        }}
                      >
                        {item.caption}
                      </Text>
                    </View>
                  </PressableScale>
                </Animated.View>
              ))}
            </View>
          ))}
        </View>

        {/* ── Assistance ─────────────────────────────────────────────────
            The one help entry worth keeping on the profile; "Signaler un
            problème" and "À propos" moved to Paramètres. */}
        <Text
          style={[
            TYPE.overline,
            { paddingHorizontal: 20, marginTop: SPACE.xxl, marginBottom: SPACE.md },
          ]}
        >
          Assistance
        </Text>

        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.delay(200).springify().damping(16)}
          style={{ paddingHorizontal: 20 }}
        >
          <PressableScale
            onPress={() => router.push("/(main)/support")}
            scaleTo={0.985}
            accessibilityLabel="Aide et contact"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              backgroundColor: COLORS.surfaceContainerLowest,
              borderRadius: 18,
              paddingHorizontal: SPACE.lg,
              paddingVertical: SPACE.lg,
              ...SHADOW.soft,
            }}
          >
            <Icon name="lifebuoy" size={24} color={COLORS.primary} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: FONTS.bodySemibold,
                  fontSize: 15,
                  color: COLORS.onSurface,
                }}
              >
                Besoin d'aide ?
              </Text>
              <Text
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 12.5,
                  lineHeight: 17,
                  color: COLORS.outline,
                  marginTop: 2,
                }}
              >
                Une question sur une commande ou un devis
              </Text>
            </View>
            <Icon name="chevron-right" size={18} color={COLORS.surfaceDim} />
          </PressableScale>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
