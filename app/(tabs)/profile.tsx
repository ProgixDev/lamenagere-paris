import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "../../components/ui/Icon";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "../../lib/constants";
import { FONTS, TYPE, SPACE, SHADOW } from "../../lib/typography";
import { useAuthStore } from "../../features/auth/store";
import { useGuestStore } from "../../features/auth/guest";
import { getNameInitials } from "../../lib/utils";
import LogoHeader from "../../components/layout/LogoHeader";
import GuestGate from "../../components/GuestGate";

const MENU_SECTIONS = [
  {
    title: "Mes achats",
    items: [
      { icon: "shopping-outline", label: "Mes Commandes", route: "/(main)/orders", badge: null },
      { icon: "file-document-outline", label: "Mes Devis", route: "/(main)/orders", badge: null },
      { icon: "heart-outline", label: "Mes Favoris", route: "/(main)/favorites", badge: null },
    ],
  },
  {
    title: "Mon compte",
    items: [
      { icon: "map-marker-outline", label: "Mes Adresses", route: "/(main)/addresses", badge: null },
      { icon: "cog-outline", label: "Paramètres", route: "/(main)/settings", badge: null },
    ],
  },
  {
    title: "Aide",
    items: [
      { icon: "lifebuoy", label: "Signaler un problème", route: "/(main)/support", badge: null },
      { icon: "help-circle-outline", label: "Aide & Contact", route: "/(main)/about", badge: null },
      { icon: "information-outline", label: "À propos", route: "/(main)/about", badge: null },
    ],
  },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, isAuthenticated } = useAuthStore();
  const isGuest = useGuestStore((s) => s.isGuest);

  const initials = user ? getNameInitials(user.fullName) : "?";

  if (isGuest && !isAuthenticated) {
    return (
      <GuestGate
        icon="account-outline"
        title="Votre espace personnel"
        message="Connectez-vous ou créez un compte pour accéder à votre profil, vos commandes et vos favoris."
      />
    );
  }

  const handleLogout = () => {
    Alert.alert(
      "Déconnexion",
      "Êtes-vous sûr de vouloir vous déconnecter ?",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Se déconnecter", style: "destructive", onPress: () => logout() },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <LogoHeader />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Profile header card */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, marginBottom: SPACE.xxl }}>
          <View
            style={{
              backgroundColor: COLORS.surfaceContainerLowest,
              borderRadius: 16,
              padding: SPACE.xl,
              alignItems: "center",
              ...SHADOW.card,
            }}
          >
            {/* Avatar */}
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <Text style={{ fontSize: 26, fontFamily: "Manrope_700Bold", color: "#ffffff" }}>
                {initials}
              </Text>
            </LinearGradient>

            <Text style={[TYPE.sectionTitle, { marginBottom: 2 }]}>
              {user?.fullName?.trim() ? user.fullName : "Utilisateur"}
            </Text>
            <Text style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.outline, marginBottom: 8 }}>
              {user?.email || ""}
            </Text>

            {user?.accountType === "professionnel" && (
              <View
                style={{
                  backgroundColor: COLORS.surfaceContainer,
                  borderRadius: 9999,
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                }}
              >
                <Text style={[TYPE.overline, { color: COLORS.primary }]}>
                  Compte Professionnel
                </Text>
              </View>
            )}

            {/* Quick edit */}
            <TouchableOpacity
              onPress={() => router.push("/(main)/edit-profile")}
              accessibilityLabel="Modifier le profil"
              style={{
                marginTop: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Icon name="pencil-outline" size={14} color={COLORS.primary} />
              <Text style={{ fontSize: 12, fontFamily: FONTS.bodyMedium, color: COLORS.primary }}>
                Modifier le profil
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu sections */}
        {MENU_SECTIONS.map((section) => (
          <View key={section.title} style={{ marginBottom: SPACE.xl }}>
            <Text
              style={[
                TYPE.overline,
                {
                  paddingHorizontal: 20,
                  marginBottom: SPACE.md,
                },
              ]}
            >
              {section.title}
            </Text>
            <View
              style={{
                marginHorizontal: 20,
                backgroundColor: COLORS.surfaceContainerLowest,
                borderRadius: 16,
                overflow: "hidden",
                ...SHADOW.card,
              }}
            >
              {section.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.label}
                  onPress={() => router.push(item.route as any)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    paddingVertical: 15,
                    gap: 14,
                    borderBottomWidth: idx < section.items.length - 1 ? 1 : 0,
                    borderBottomColor: COLORS.outlineVariant,
                  }}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 11,
                      backgroundColor: COLORS.surfaceContainer,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon
                      name={item.icon as any}
                      size={20}
                      color={COLORS.primary}
                    />
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 15,
                      fontFamily: FONTS.bodyMedium,
                      color: COLORS.onSurface,
                    }}
                  >
                    {item.label}
                  </Text>
                  <Icon name="chevron-right" size={18} color={COLORS.surfaceDim} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Logout */}
        <View style={{ paddingHorizontal: 20, marginTop: SPACE.xs }}>
          <TouchableOpacity
            onPress={handleLogout}
            activeOpacity={0.7}
            accessibilityLabel="Se déconnecter"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 15,
              paddingHorizontal: 16,
              backgroundColor: COLORS.error + "0F",
              borderRadius: 16,
            }}
          >
            <Icon name="logout" size={20} color={COLORS.error} />
            <Text style={{ fontSize: 15, fontFamily: FONTS.bodyMedium, color: COLORS.error }}>
              Se déconnecter
            </Text>
          </TouchableOpacity>
        </View>

        {/* Version */}
        <Text
          style={{
            fontSize: 11,
            fontFamily: FONTS.body,
            color: COLORS.surfaceDim,
            textAlign: "center",
            marginTop: SPACE.xl,
          }}
        >
          La Ménagère Paris — v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
