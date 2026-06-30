import React from "react";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Icon from "./ui/Icon";
import Button from "./ui/Button";
import { COLORS } from "../lib/constants";
import { FONTS, TYPE } from "../lib/typography";

/**
 * Full-screen "sign in required" prompt shown on account-only tabs (profil,
 * messages, …) while the visitor is browsing as a guest. Keeps personal areas
 * empty for guests (no personal data) and offers a clear path to authenticate.
 */
export default function GuestGate({
  icon = "account-outline",
  title,
  message,
}: {
  icon?: string;
  title: string;
  message: string;
}) {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: COLORS.surfaceContainer,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <Icon name={icon} size={34} color={COLORS.primary} />
        </View>
        <Text style={[TYPE.sectionTitle, { textAlign: "center", marginBottom: 8 }]}>{title}</Text>
        <Text
          style={{
            fontSize: 13,
            fontFamily: FONTS.body,
            color: COLORS.onSurfaceVariant,
            textAlign: "center",
            lineHeight: 20,
            marginBottom: 24,
          }}
        >
          {message}
        </Text>
        <View style={{ width: "100%", gap: 10 }}>
          <Button label="SE CONNECTER" onPress={() => router.push("/(auth)/login")} size="md" />
          <Button
            label="CRÉER UN COMPTE"
            variant="secondary"
            onPress={() => router.push("/(auth)/register")}
            size="md"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
