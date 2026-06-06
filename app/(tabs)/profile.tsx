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
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "../../lib/constants";
import { useAuthStore } from "../../features/auth/store";
import { getInitials } from "../../lib/utils";

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
  const { user, logout } = useAuthStore();

  const initials = user
    ? getInitials(user.firstName, user.lastName)
    : "?";

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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Profile header card */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, marginBottom: 24 }}>
          <View
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 16,
              padding: 20,
              alignItems: "center",
              shadowColor: "rgba(0,0,0,0.05)",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 1,
              shadowRadius: 12,
              elevation: 2,
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

            <Text style={{ fontSize: 18, fontFamily: "Manrope_700Bold", color: COLORS.onSurface, marginBottom: 2 }}>
              {user ? `${user.firstName} ${user.lastName}` : "Utilisateur"}
            </Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: COLORS.outline, marginBottom: 8 }}>
              {user?.email || ""}
            </Text>

            {user?.accountType === "professionnel" && (
              <View
                style={{
                  backgroundColor: "#fef3e7",
                  borderRadius: 9999,
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: COLORS.secondary }}>
                  Compte Professionnel
                </Text>
              </View>
            )}

            {/* Quick edit */}
            <TouchableOpacity
              onPress={() => router.push("/(main)/settings")}
              style={{
                marginTop: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <MaterialCommunityIcons name="pencil-outline" size={14} color={COLORS.secondary} />
              <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: COLORS.secondary }}>
                Modifier le profil
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu sections */}
        {MENU_SECTIONS.map((section) => (
          <View key={section.title} style={{ marginBottom: 20 }}>
            <Text
              style={{
                fontSize: 10,
                fontFamily: "Inter_600SemiBold",
                color: COLORS.outline,
                textTransform: "uppercase",
                letterSpacing: 2,
                paddingHorizontal: 20,
                marginBottom: 8,
              }}
            >
              {section.title}
            </Text>
            <View
              style={{
                marginHorizontal: 20,
                backgroundColor: "#ffffff",
                borderRadius: 14,
                overflow: "hidden",
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
                    paddingVertical: 14,
                    gap: 14,
                    borderBottomWidth: idx < section.items.length - 1 ? 1 : 0,
                    borderBottomColor: "#f5f5f5",
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: "#f8f6f3",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MaterialCommunityIcons
                      name={item.icon as any}
                      size={20}
                      color={COLORS.primary}
                    />
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 14,
                      fontFamily: "Inter_500Medium",
                      color: COLORS.onSurface,
                    }}
                  >
                    {item.label}
                  </Text>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.surfaceDim} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Logout */}
        <View style={{ paddingHorizontal: 20, marginTop: 4 }}>
          <TouchableOpacity
            onPress={handleLogout}
            activeOpacity={0.7}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 14,
              paddingHorizontal: 16,
              backgroundColor: "#fff5f5",
              borderRadius: 14,
            }}
          >
            <MaterialCommunityIcons name="logout" size={20} color="#dc3545" />
            <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: "#dc3545" }}>
              Se déconnecter
            </Text>
          </TouchableOpacity>
        </View>

        {/* Version */}
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Inter_400Regular",
            color: COLORS.surfaceDim,
            textAlign: "center",
            marginTop: 24,
          }}
        >
          La Ménagère Paris — v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
