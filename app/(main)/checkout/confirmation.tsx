import React from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../../lib/constants";
import { FONTS, TYPE } from "../../../lib/typography";
import { formatDate } from "../../../lib/utils";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import { useCheckoutStore } from "../../../features/checkout/store";

export default function CheckoutConfirmationScreen() {
  const router = useRouter();
  const today = new Date();
  const lastOrderNumber = useCheckoutStore((s) => s.lastOrderNumber);
  const reset = useCheckoutStore((s) => s.reset);
  const orderNumber = lastOrderNumber ? `#${lastOrderNumber}` : "Commande";

  const goTo = (path: "/(main)/orders" | "/(tabs)", replace?: boolean) => {
    reset();
    if (replace) router.replace(path);
    else router.push(path);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 40, alignItems: "center" }}>
        <View
          className="w-16 h-16 rounded-full items-center justify-center mb-6"
          style={{ backgroundColor: COLORS.success }}
        >
          <MaterialCommunityIcons name="check" size={32} color="#fff" />
        </View>

        <Text style={[TYPE.hero, { color: COLORS.primary, marginBottom: 8, textAlign: "center" }]}>
          Commande confirmée !
        </Text>
        <Text className="text-sm mb-8" style={{ color: COLORS.onSurfaceVariant }}>
          Merci pour votre confiance.
        </Text>

        <Card padding="lg">
          <View className="gap-3 w-full">
            <Text style={{ color: COLORS.onSurface, fontFamily: FONTS.serif, fontSize: 22 }}>
              {orderNumber}
            </Text>
            <Text className="text-sm" style={{ color: COLORS.outline }}>
              {formatDate(today)}
            </Text>
            <View className="mt-2 pt-2" style={{ borderTopWidth: 1, borderTopColor: COLORS.surfaceContainerLow }}>
              <Text className="text-sm" style={{ color: COLORS.secondary }}>
                Livraison estimée : {formatDate(new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000))}
              </Text>
            </View>
          </View>
        </Card>

        <View className="w-full mt-8 gap-4">
          <Button label="Suivi de commande" onPress={() => goTo("/(main)/orders")} variant="secondary" size="lg" />
          <Button label="Continuer le shopping" onPress={() => goTo("/(tabs)", true)} size="lg" />
        </View>

        <Text className="text-xs mt-6 text-center" style={{ color: COLORS.onSurfaceVariant }}>
          Un e-mail de confirmation a été envoyé à votre adresse.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
