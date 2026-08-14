import React, { useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { COLORS } from "../lib/constants";

/**
 * Landing route for the Stripe redirect (`lamenagere://stripe-redirect`), used
 * by payment methods that leave the app — 3DS challenges, Klarna, Bancontact.
 *
 * The URL itself is handed to the SDK by <StripeRedirectListener> in
 * components/StripeGate.tsx; this route exists only because expo-router routes
 * every incoming deep link, and without a matching screen the customer would
 * land on the "Unmatched Route" page mid-payment.
 *
 * The Payment Sheet is still presented natively above us at this point, so we
 * step straight back to the checkout screen underneath: when the sheet resolves
 * it navigates on to the confirmation, and if the payment fails or is cancelled
 * the customer is already back on the payment screen to retry.
 */
export default function StripeRedirectScreen() {
  const router = useRouter();

  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(main)/checkout/payment");
  }, [router]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.background,
        gap: 16,
      }}
    >
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={{ color: COLORS.onSurfaceVariant }}>
        Finalisation du paiement…
      </Text>
    </View>
  );
}
