import React, { useState } from "react";
import { View, Text, Linking, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../lib/constants";
import { FONTS } from "../../lib/typography";
import Button from "../ui/Button";
import { getInvoiceLinkApi } from "../../features/orders/api";
import { useAuthStore } from "../../features/auth/store";

/**
 * The facture is emailed to the customer automatically the moment their
 * payment succeeds — nothing here triggers it. This block only tells them
 * where it went and, on an order they come back to later, lets them re-open
 * the PDF they already received.
 *
 * `showDownload` is off on the confirmation screen: right after paying, the
 * customer is told their facture is on its way and asked to decide nothing.
 */
export default function InvoiceActions({
  orderId,
  showDownload = true,
}: {
  orderId: string;
  showDownload?: boolean;
}) {
  const email = useAuthStore((s) => s.user?.email);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const { url } = await getInvoiceLinkApi(orderId);
      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert(
        "Erreur",
        e?.message || "La facture n'a pas pu être ouverte. Réessayez.",
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <View>
      <View className="flex-row items-center gap-2 mb-3">
        <MaterialCommunityIcons name="receipt" size={20} color={COLORS.primary} />
        <Text style={{ color: COLORS.onSurface, fontFamily: FONTS.serif, fontSize: 18 }}>
          Facture
        </Text>
      </View>
      <Text
        style={{
          fontSize: 12.5,
          lineHeight: 18,
          fontFamily: FONTS.body,
          color: COLORS.onSurfaceVariant,
          marginBottom: showDownload ? 14 : 0,
        }}
      >
        {email
          ? `Votre facture a été envoyée par email à ${email}.`
          : "Votre facture vous a été envoyée par email."}
        {" "}
        Elle reste disponible à tout moment dans Paiements & factures.
      </Text>
      {showDownload ? (
        <Button
          label="Télécharger la facture"
          onPress={handleDownload}
          variant="secondary"
          size="md"
          loading={downloading}
          icon={(color) => (
            <MaterialCommunityIcons name="tray-arrow-down" size={18} color={color} />
          )}
        />
      ) : null}
    </View>
  );
}
