import React from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../../lib/constants";
import { FONTS, TYPE, SHADOW } from "../../../lib/typography";
import { formatPrice, isOverseas } from "../../../lib/utils";
import Button from "../../../components/ui/Button";
import CheckoutSteps from "../../../components/cart/CheckoutSteps";
import { useCart } from "../../../features/cart/hooks";
import { useCheckoutStore } from "../../../features/checkout/store";
import { useShippingOptions } from "../../../features/shipping/hooks";

export default function CheckoutShippingScreen() {
  const router = useRouter();
  const { subtotal } = useCart();
  const territory = useCheckoutStore((s) => s.territory);
  const setShippingMethod = useCheckoutStore((s) => s.setShippingMethod);

  const overseas = isOverseas(territory);
  const { data: shippingOptions, isLoading } = useShippingOptions();
  const option = shippingOptions?.find((o) => o.territory === territory);

  const shippingCost = option?.fee ?? 0;

  const onContinue = () => {
    if (!option) return;
    setShippingMethod(option.territory);
    router.push("/(main)/checkout/payment");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View className="px-6 py-4 flex-row items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-3"
          accessibilityLabel="Retour"
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={[TYPE.screenTitle, { color: COLORS.primary }]}>
          Livraison
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
        <CheckoutSteps currentStep={2} />

        {overseas && (
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 24, padding: 14, borderRadius: 14, backgroundColor: COLORS.surfaceContainerLow }}>
            <MaterialCommunityIcons name="information-outline" size={16} color={COLORS.primary} />
            <Text style={{ flex: 1, fontSize: 12, color: COLORS.onSurfaceVariant, fontFamily: "Inter_400Regular", lineHeight: 18 }}>
              Livraison outre-mer : délais et frais spécifiques. La voie maritime est gratuite mais plus longue.
            </Text>
          </View>
        )}

        <Text style={[TYPE.overline, { marginBottom: 12 }]}>
          Mode de livraison
        </Text>
        <View className="gap-3 mb-8">
          {isLoading ? (
            <View style={{ paddingVertical: 24, alignItems: "center" }}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : option ? (
            <View
              className="flex-row items-center justify-between px-6 py-4"
              style={{ backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.primary, ...SHADOW.soft }}
            >
              <Text style={{ color: COLORS.onSurface, fontFamily: FONTS.bodySemibold, fontSize: 14 }}>
                {option.delay}
              </Text>
              <Text style={[TYPE.price, { fontSize: 18, color: COLORS.primary }]}>
                {option.fee === 0 ? "Gratuit" : `+${formatPrice(option.fee)}`}
              </Text>
            </View>
          ) : (
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: COLORS.outline }}>
              Aucune option de livraison disponible pour cette destination.
            </Text>
          )}
        </View>

        <View style={{ backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 20, marginBottom: 32, ...SHADOW.card }}>
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm" style={{ color: COLORS.onSurface }}>Sous-total</Text>
            <Text className="text-sm" style={{ color: COLORS.onSurface }}>{formatPrice(subtotal)}</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm" style={{ color: COLORS.outline }}>Livraison</Text>
            <Text className="text-sm" style={{ color: COLORS.outline }}>
              {shippingCost === 0 ? "Gratuit" : formatPrice(shippingCost)}
            </Text>
          </View>
          <View className="flex-row justify-between items-center mt-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: COLORS.outlineVariant }}>
            <Text style={{ color: COLORS.onSurface, fontFamily: FONTS.serif, fontSize: 20 }}>Total</Text>
            <Text style={[TYPE.priceLarge, { color: COLORS.primary }]}>
              {formatPrice(subtotal + shippingCost)}
            </Text>
          </View>
        </View>

        <Button label="Continuer vers le paiement →" onPress={onContinue} size="lg" disabled={!option} />
      </ScrollView>
    </SafeAreaView>
  );
}
