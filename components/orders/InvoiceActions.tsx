import React, { useState } from "react";
import { View, Text, Linking, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../lib/constants";
import { FONTS } from "../../lib/typography";
import Button from "../ui/Button";
import {
  getInvoiceLinkApi,
  emailInvoiceApi,
} from "../../features/orders/api";

const EMAIL_FAILURE_MESSAGE: Record<string, string> = {
  no_email: "Aucune adresse email n'est associée à votre compte.",
  default:
    "L'envoi a échoué. Réessayez plus tard, ou téléchargez votre facture directement.",
};

/**
 * Lets the customer choose what happens to their facture, rather than it
 * being emailed to them automatically. Used on the payment confirmation
 * screen and on an order's detail screen — both places show it only once
 * the order is confirmed paid.
 */
export default function InvoiceActions({ orderId }: { orderId: string }) {
  const [downloading, setDownloading] = useState(false);
  const [emailing, setEmailing] = useState(false);

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

  const handleEmail = async () => {
    if (emailing) return;
    setEmailing(true);
    try {
      const res = await emailInvoiceApi(orderId);
      if (res.sent) {
        Alert.alert("Facture envoyée", "Vous la recevrez par email d'un instant à l'autre.");
      } else {
        Alert.alert(
          "Envoi impossible",
          EMAIL_FAILURE_MESSAGE[res.reason ?? "default"] ?? EMAIL_FAILURE_MESSAGE.default,
        );
      }
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "L'envoi a échoué. Réessayez.");
    } finally {
      setEmailing(false);
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
          marginBottom: 14,
        }}
      >
        Téléchargez-la maintenant ou recevez-la par email — elle reste aussi
        disponible à tout moment dans Paiements & factures.
      </Text>
      <View style={{ gap: 10 }}>
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
        <Button
          label="Recevoir par email"
          onPress={handleEmail}
          variant="secondary"
          size="md"
          loading={emailing}
          icon={(color) => (
            <MaterialCommunityIcons name="email-outline" size={18} color={color} />
          )}
        />
      </View>
    </View>
  );
}
