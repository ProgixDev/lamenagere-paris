import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useStripe } from "@stripe/stripe-react-native";
import * as Haptics from "expo-haptics";
import { COLORS } from "../../../lib/constants";
import { formatPrice } from "../../../lib/utils";
import Button from "../../../components/ui/Button";
import CheckoutSteps from "../../../components/cart/CheckoutSteps";
import { useCart } from "../../../features/cart/hooks";
import { createOrderApi } from "../../../features/orders/api";
import { createPaymentIntentApi } from "../../../features/payments/api";
import { useCheckoutStore } from "../../../features/checkout/store";
import { isStripeAvailable } from "../../../components/StripeGate";

export default function CheckoutPaymentScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { items, subtotal, clearCart } = useCart();
  const { shippingAddressId, territory, shippingMethod, setLastOrderNumber } =
    useCheckoutStore();
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    if (!shippingAddressId) {
      Alert.alert(
        "Adresse manquante",
        "Veuillez sélectionner une adresse de livraison.",
      );
      return;
    }
    if (!isStripeAvailable()) {
      Alert.alert(
        "Paiement indisponible",
        "Le paiement en ligne nécessite la dernière version native de l'application. Mettez à jour l'application (build de développement) et réessayez.",
      );
      return;
    }
    setLoading(true);
    try {
      // 1. Create the order (treated as pending payment) to obtain its id.
      const order = await createOrderApi({
        items: items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          customDimensions: item.customDimensions,
          openingType: item.openingType,
        })),
        shippingAddressId,
        shippingMethod,
        territory,
      });

      // 2. Create the Stripe PaymentIntent for that order.
      const { clientSecret } = await createPaymentIntentApi(order.id);

      // 3. Initialize the Payment Sheet (Stripe collects card details itself).
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: "La Ménagère Paris",
        paymentIntentClientSecret: clientSecret,
      });
      if (initError) {
        Alert.alert(
          "Erreur",
          initError.message || "Le paiement n'a pas pu être initialisé.",
        );
        return;
      }

      // 4. Present the Payment Sheet and let the user pay.
      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        // User cancelled or the payment failed. Leave the order unpaid so they
        // can retry; do NOT clear the cart.
        if (presentError.code !== "Canceled") {
          Alert.alert(
            "Paiement non abouti",
            presentError.message || "Le paiement a échoué. Réessayez.",
          );
        }
        return;
      }

      // 5. Payment succeeded.
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      clearCart();
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setLastOrderNumber(order.orderNumber);
      router.replace("/(main)/checkout/confirmation");
    } catch (e: any) {
      Alert.alert(
        "Erreur",
        e?.message || "La commande n'a pas pu être créée. Réessayez.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View className="px-6 py-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text className="text-lg font-semibold" style={{ color: COLORS.primary, fontFamily: "Manrope_700Bold" }}>
          Paiement
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
        <CheckoutSteps currentStep={3} />

        <View className="rounded-xl p-6 mb-6 flex-row items-center gap-3" style={{ backgroundColor: COLORS.surfaceContainerLow }}>
          <MaterialCommunityIcons name="credit-card-outline" size={24} color={COLORS.secondary} />
          <Text className="flex-1 text-sm" style={{ color: COLORS.primary, fontFamily: "Inter_500Medium" }}>
            Vous renseignerez vos informations de carte en toute sécurité à
            l'étape suivante.
          </Text>
        </View>

        <View className="rounded-xl p-6 mb-8" style={{ backgroundColor: COLORS.surfaceContainerLow }}>
          <View className="flex-row justify-between">
            <Text className="font-bold" style={{ color: COLORS.primary, fontFamily: "Manrope_800ExtraBold" }}>Total à payer</Text>
            <Text className="text-lg font-bold" style={{ color: COLORS.secondary, fontFamily: "Manrope_700Bold" }}>
              {formatPrice(subtotal)}
            </Text>
          </View>
        </View>

        <Button label="Payer" onPress={handlePayment} loading={loading} size="lg" />

        <Text className="text-[10px] text-center mt-4" style={{ color: COLORS.outline }}>
          Paiement sécurisé par Stripe. Vos données sont chiffrées.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
