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
import { FONTS, TYPE, SPACE, SHADOW } from "../../lib/typography";

export default function AboutScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Retour">
          <MaterialCommunityIcons name="chevron-left" size={26} color={COLORS.onSurface} />
        </TouchableOpacity>
        <Text style={TYPE.screenTitle}>
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

        <Text style={[TYPE.overline, { marginBottom: SPACE.xl }]}>
          Version 1.0.0
        </Text>

        {/* Description */}
        <View style={{ paddingHorizontal: 32, marginBottom: SPACE.xxl }}>
          <Text
            style={{
              fontSize: 15,
              fontFamily: FONTS.body,
              color: COLORS.onSurface,
              textAlign: "center",
              lineHeight: 24,
            }}
          >
            La Ménagère Paris est spécialisée dans la vente de mobilier haut de gamme, portes, cuisines et décoration pour les particuliers et professionnels en France métropolitaine et outre-mer.
          </Text>
        </View>

        {/* Contact card */}
        <View
          style={{
            marginHorizontal: 20,
            backgroundColor: COLORS.surfaceContainerLowest,
            borderRadius: 16,
            padding: SPACE.lg,
            gap: 14,
            width: "90%",
            marginBottom: SPACE.xl,
            ...SHADOW.card,
          }}
        >
          <Text style={TYPE.overline}>
            Contact
          </Text>
          {[
            { icon: "email-outline", text: "contact@lamenagereparis.fr" },
            { icon: "phone-outline", text: "+33 1 XX XX XX XX" },
            { icon: "web", text: "www.lamenagereparis.fr" },
          ].map((item) => (
            <View key={item.icon} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <MaterialCommunityIcons name={item.icon as any} size={18} color={COLORS.primary} />
              <Text style={{ fontSize: 14, fontFamily: FONTS.body, color: COLORS.onSurface }}>{item.text}</Text>
            </View>
          ))}
        </View>

        {/* Social */}
        <View style={{ flexDirection: "row", gap: 16, marginBottom: SPACE.xxl }}>
          {[
            { icon: "instagram", url: "https://www.instagram.com/lamenagereparis" },
            { icon: "facebook", url: "https://www.facebook.com/lamenagereparis" },
            { icon: "linkedin", url: "https://www.linkedin.com/company/lamenagereparis" },
          ].map((social) => (
            <TouchableOpacity
              key={social.icon}
              onPress={() => Linking.openURL(social.url)}
              accessibilityLabel={social.icon}
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                backgroundColor: COLORS.surfaceContainerLowest,
                alignItems: "center",
                justifyContent: "center",
                ...SHADOW.soft,
              }}
            >
              <MaterialCommunityIcons name={social.icon as any} size={22} color={COLORS.primary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Legal links */}
        <View style={{ gap: 10, marginBottom: SPACE.xxl }}>
          {([
            { label: "Conditions générales", route: "/(main)/legal/terms" },
            { label: "Politique de confidentialité", route: "/(main)/legal/privacy" },
            { label: "CGV", route: "/(main)/legal/cgv" },
          ] as const).map((item) => (
            <TouchableOpacity key={item.label} onPress={() => router.push(item.route as any)}>
              <Text style={{ fontSize: 13, fontFamily: FONTS.body, color: COLORS.outline, textDecorationLine: "underline", textAlign: "center" }}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ fontSize: 11, fontFamily: FONTS.body, color: COLORS.surfaceDim }}>
          © 2026 La Ménagère Paris. Tous droits réservés.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
