import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, APP_NAME } from "../../lib/constants";

export default function AboutScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={COLORS.onSurface} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontFamily: "Manrope_700Bold", color: COLORS.onSurface }}>
          À propos
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, alignItems: "center" }}>
        {/* Logo */}
        <View style={{ marginTop: 20, marginBottom: 20 }}>
          <Image
            source={require("../../assets/images/logo.png")}
            style={{ width: 160, height: 70, resizeMode: "contain" }}
          />
        </View>

        <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.outline, marginBottom: 24 }}>
          Version 1.0.0
        </Text>

        {/* Description */}
        <View style={{ paddingHorizontal: 32, marginBottom: 28 }}>
          <Text
            style={{
              fontSize: 14,
              fontFamily: "Inter_400Regular",
              color: COLORS.onSurface,
              textAlign: "center",
              lineHeight: 22,
            }}
          >
            La Ménagère Paris est spécialisée dans la vente de mobilier haut de gamme, portes, cuisines et décoration pour les particuliers et professionnels en France métropolitaine et outre-mer.
          </Text>
        </View>

        {/* Contact card */}
        <View
          style={{
            marginHorizontal: 20,
            backgroundColor: "#ffffff",
            borderRadius: 14,
            padding: 16,
            gap: 14,
            width: "90%",
            marginBottom: 24,
          }}
        >
          <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: COLORS.outline, textTransform: "uppercase", letterSpacing: 2 }}>
            Contact
          </Text>
          {[
            { icon: "email-outline", text: "contact@lamenagereparis.fr" },
            { icon: "phone-outline", text: "+33 1 XX XX XX XX" },
            { icon: "web", text: "www.lamenagereparis.fr" },
          ].map((item) => (
            <View key={item.icon} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <MaterialCommunityIcons name={item.icon as any} size={18} color={COLORS.secondary} />
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: COLORS.onSurface }}>{item.text}</Text>
            </View>
          ))}
        </View>

        {/* Social */}
        <View style={{ flexDirection: "row", gap: 16, marginBottom: 28 }}>
          {[
            { icon: "instagram", url: "https://www.instagram.com/lamenagereparis" },
            { icon: "facebook", url: "https://www.facebook.com/lamenagereparis" },
            { icon: "linkedin", url: "https://www.linkedin.com/company/lamenagereparis" },
          ].map((social) => (
            <TouchableOpacity
              key={social.icon}
              onPress={() => Linking.openURL(social.url)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: "#ffffff",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialCommunityIcons name={social.icon as any} size={22} color={COLORS.primary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Legal links */}
        <View style={{ gap: 8, marginBottom: 28 }}>
          {([
            { label: "Conditions générales", route: "/(main)/legal/terms" },
            { label: "Politique de confidentialité", route: "/(main)/legal/privacy" },
            { label: "CGV", route: "/(main)/legal/cgv" },
          ] as const).map((item) => (
            <TouchableOpacity key={item.label} onPress={() => router.push(item.route as any)}>
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: COLORS.outline, textDecorationLine: "underline" }}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: COLORS.surfaceDim }}>
          © 2026 La Ménagère Paris. Tous droits réservés.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
