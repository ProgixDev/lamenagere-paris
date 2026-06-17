import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../../lib/constants";
import { formatPrice, isOverseas } from "../../../lib/utils";
import Button from "../../../components/ui/Button";
import CheckoutSteps from "../../../components/cart/CheckoutSteps";
import { useCart } from "../../../features/cart/hooks";
import { useCheckoutStore } from "../../../features/checkout/store";

function shippingMethodsFor(overseas: boolean) {
  if (overseas) {
    return [
      { id: "maritime", label: "Maritime (8-12 semaines)", price: 0 },
      { id: "aerien", label: "Aérien (2-3 semaines)", price: 350 },
    ];
  }
  return [
    { id: "standard", label: "Standard (2-3 semaines)", price: 0 },
    { id: "express", label: "Express (5-7 jours)", price: 50 },
  ];
}

export default function CheckoutShippingScreen() {
  const router = useRouter();
  const { subtotal } = useCart();
  const territory = useCheckoutStore((s) => s.territory);
  const setShippingMethod = useCheckoutStore((s) => s.setShippingMethod);

  const overseas = isOverseas(territory);
  const methods = useMemo(() => shippingMethodsFor(overseas), [overseas]);
  const [selectedMethod, setSelectedMethod] = useState(methods[0].id);

  // Keep selection valid when the territory (and thus methods) changes.
  useEffect(() => {
    if (!methods.some((m) => m.id === selectedMethod)) {
      setSelectedMethod(methods[0].id);
    }
  }, [methods, selectedMethod]);

  const shippingCost = methods.find((m) => m.id === selectedMethod)?.price || 0;

  const onContinue = () => {
    setShippingMethod(selectedMethod);
    router.push("/(main)/checkout/payment");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View className="px-6 py-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text className="text-lg font-semibold" style={{ color: COLORS.primary, fontFamily: "Manrope_700Bold" }}>
          Livraison
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
        <CheckoutSteps currentStep={2} />

        {overseas && (
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 16, padding: 12, borderRadius: 10, backgroundColor: "#FFF7ED" }}>
            <MaterialCommunityIcons name="information-outline" size={16} color={COLORS.warning} />
            <Text style={{ flex: 1, fontSize: 12, color: COLORS.onSurface, fontFamily: "Inter_400Regular", lineHeight: 18 }}>
              Livraison outre-mer : délais et frais spécifiques. La voie maritime est gratuite mais plus longue.
            </Text>
          </View>
        )}

        <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: COLORS.outline, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
          Mode de livraison
        </Text>
        <View className="gap-3 mb-8">
          {methods.map((method) => (
            <TouchableOpacity
              key={method.id}
              onPress={() => setSelectedMethod(method.id)}
              className="flex-row items-center justify-between rounded-full px-6 py-4"
              style={{
                backgroundColor: selectedMethod === method.id ? COLORS.primary : "transparent",
                borderWidth: 1,
                borderColor: selectedMethod === method.id ? COLORS.primary : `${COLORS.outlineVariant}33`,
              }}
            >
              <Text style={{ color: selectedMethod === method.id ? COLORS.onPrimary : COLORS.onSurface }} className="text-sm font-semibold">
                {method.label}
              </Text>
              <Text style={{ color: selectedMethod === method.id ? COLORS.onPrimary : COLORS.outline }} className="text-sm">
                {method.price === 0 ? "Gratuit" : `+${formatPrice(method.price)}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View className="rounded-xl p-6 mb-8" style={{ backgroundColor: COLORS.surfaceContainerLow }}>
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
          <View className="flex-row justify-between mt-2 pt-2" style={{ borderTopWidth: 1, borderTopColor: COLORS.surfaceContainer }}>
            <Text className="font-bold" style={{ color: COLORS.primary, fontFamily: "Manrope_800ExtraBold" }}>Total</Text>
            <Text className="text-lg font-bold" style={{ color: COLORS.secondary, fontFamily: "Manrope_700Bold" }}>
              {formatPrice(subtotal + shippingCost)}
            </Text>
          </View>
        </View>

        <Button label="Continuer vers le paiement →" onPress={onContinue} size="lg" />
      </ScrollView>
    </SafeAreaView>
  );
}
