import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useStripe } from "@stripe/stripe-react-native";
import * as Haptics from "expo-haptics";
import { COLORS } from "../../../lib/constants";
import { FONTS, TYPE, SHADOW } from "../../../lib/typography";
import { formatPrice } from "../../../lib/utils";
import Button from "../../../components/ui/Button";
import CheckoutSteps from "../../../components/cart/CheckoutSteps";
import { useCart } from "../../../features/cart/hooks";
import { createOrderApi } from "../../../features/orders/api";
import {
  pickMessageMedia,
  uploadMessageMedia,
  type Attachment,
} from "../../../features/messaging/upload";
import {
  createPaymentIntentApi,
  confirmPaymentApi,
} from "../../../features/payments/api";
import { useCheckoutStore } from "../../../features/checkout/store";
import { validatePromoApi } from "../../../features/promo/api";
import { isStripeAvailable } from "../../../components/StripeGate";

export default function CheckoutPaymentScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { items, subtotal, clearCart } = useCart();
  const {
    address,
    territory,
    shippingMethod,
    setLastOrderNumber,
    appliedPromo,
    setAppliedPromo,
  } = useCheckoutStore();
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  const discount = appliedPromo ? appliedPromo.discountCents / 100 : 0;
  const totalDue = Math.max(0, subtotal - discount);

  const applyPromo = async () => {
    const code = promoInput.trim();
    if (!code || promoLoading) return;
    setPromoLoading(true);
    setPromoError(null);
    try {
      const lineItems = items.map((item) => ({
        productId: item.product.id,
        lineTotalCents: Math.round(
          (item.calculatedPrice || item.product.price || 0) * item.quantity * 100,
        ),
      }));
      const res = await validatePromoApi(code, lineItems);
      if (res.valid && res.discountCents) {
        setAppliedPromo({ code: res.code ?? code.toUpperCase(), discountCents: res.discountCents });
        setPromoInput("");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setAppliedPromo(null);
        setPromoError(res.message ?? "Code promo invalide");
      }
    } catch (e: any) {
      setPromoError(e?.message ?? "Vérification impossible. Réessayez.");
    } finally {
      setPromoLoading(false);
    }
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoError(null);
  };

  const handlePickAttachment = async () => {
    if (uploading || loading) return;
    const asset = await pickMessageMedia();
    if (!asset) return;
    setUploading(true);
    try {
      const uploaded = await uploadMessageMedia(asset);
      setAttachments((prev) => [...prev, uploaded]);
    } catch {
      Alert.alert("Erreur", "L'envoi du fichier a échoué. Réessayez.");
    } finally {
      setUploading(false);
    }
  };

  const handlePayment = async () => {
    if (!address) {
      Alert.alert(
        "Adresse manquante",
        "Veuillez renseigner votre adresse de livraison.",
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
          qualityTier: item.qualityTier,
          configuration: item.configuration,
          quoteId: item.quoteId,
        })),
        shippingAddress: { ...address, territory },
        shippingMethod,
        territory,
        promoCode: appliedPromo?.code,
        customerNote: note.trim() || undefined,
        customerAttachments: attachments.length ? attachments : undefined,
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

      // 5. Payment succeeded. Ask the server to re-verify the PaymentIntent and
      // mark the order paid immediately. Best-effort: the charge already went
      // through, and the webhook reconciles if this call fails, so a failure
      // here must not block the success screen.
      try {
        await confirmPaymentApi(order.id);
      } catch {
        // ignore — webhook backstop will reconcile the order status
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      clearCart();
      setAppliedPromo(null);
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
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-3"
          accessibilityLabel="Retour"
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={[TYPE.screenTitle, { color: COLORS.primary }]}>
          Paiement
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
        <CheckoutSteps currentStep={2} />

        <View className="flex-row items-center gap-3" style={{ backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 16, marginBottom: 24, ...SHADOW.card }}>
          <MaterialCommunityIcons name="credit-card-outline" size={24} color={COLORS.primary} />
          <Text className="flex-1 text-sm" style={{ color: COLORS.onSurfaceVariant, fontFamily: "Inter_500Medium", lineHeight: 20 }}>
            Vous renseignerez vos informations de carte en toute sécurité à
            l'étape suivante.
          </Text>
        </View>

        {/* Promo code */}
        <View style={{ backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 16, marginBottom: 16, ...SHADOW.card }}>
          <View className="flex-row items-center gap-2 mb-3">
            <MaterialCommunityIcons name="ticket-percent-outline" size={20} color={COLORS.primary} />
            <Text style={{ color: COLORS.onSurface, fontFamily: FONTS.serif, fontSize: 18 }}>
              Code promo
            </Text>
          </View>

          {appliedPromo ? (
            <View
              className="flex-row items-center justify-between rounded-xl px-4 py-3"
              style={{ backgroundColor: COLORS.background }}
            >
              <View className="flex-row items-center gap-2 flex-1">
                <MaterialCommunityIcons name="check-circle" size={18} color={COLORS.secondary} />
                <Text style={{ fontFamily: "Inter_600SemiBold", color: COLORS.onSurface, letterSpacing: 1 }}>
                  {appliedPromo.code}
                </Text>
                <Text style={{ color: COLORS.secondary, fontFamily: "Inter_500Medium" }}>
                  −{formatPrice(discount)}
                </Text>
              </View>
              <TouchableOpacity onPress={removePromo} hitSlop={8} disabled={loading}>
                <Text style={{ color: COLORS.outline, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                  Retirer
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View className="flex-row gap-2">
                <View className="flex-1 rounded-xl px-4 py-3" style={{ backgroundColor: COLORS.background }}>
                  <TextInput
                    value={promoInput}
                    onChangeText={(t) => {
                      setPromoInput(t);
                      setPromoError(null);
                    }}
                    placeholder="Entrer un code"
                    placeholderTextColor={COLORS.surfaceDim}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    editable={!promoLoading && !loading}
                    onSubmitEditing={applyPromo}
                    returnKeyType="done"
                    style={{ fontSize: 14, color: COLORS.onSurface, fontFamily: "Inter_500Medium", letterSpacing: 1 }}
                  />
                </View>
                <TouchableOpacity
                  onPress={applyPromo}
                  disabled={promoLoading || !promoInput.trim()}
                  className="rounded-xl px-5 items-center justify-center"
                  style={{ backgroundColor: COLORS.primary, opacity: promoLoading || !promoInput.trim() ? 0.5 : 1 }}
                >
                  {promoLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold" }}>Appliquer</Text>
                  )}
                </TouchableOpacity>
              </View>
              {promoError ? (
                <Text style={{ color: COLORS.error, fontSize: 12, marginTop: 8, fontFamily: "Inter_400Regular" }}>
                  {promoError}
                </Text>
              ) : null}
            </>
          )}
        </View>

        {/* Totals */}
        <View style={{ backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 20, marginBottom: 32, ...SHADOW.card }}>
          <View className="flex-row justify-between items-center mb-2">
            <Text style={{ color: COLORS.onSurfaceVariant, fontFamily: "Inter_500Medium", fontSize: 14 }}>Sous-total</Text>
            <Text style={{ color: COLORS.onSurface, fontFamily: "Inter_500Medium", fontSize: 14 }}>{formatPrice(subtotal)}</Text>
          </View>
          {discount > 0 ? (
            <View className="flex-row justify-between items-center mb-2">
              <Text style={{ color: COLORS.secondary, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                Réduction{appliedPromo ? ` (${appliedPromo.code})` : ""}
              </Text>
              <Text style={{ color: COLORS.secondary, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                −{formatPrice(discount)}
              </Text>
            </View>
          ) : null}
          <View className="flex-row justify-between items-center mt-2 pt-3" style={{ borderTopWidth: 1, borderTopColor: COLORS.outlineVariant }}>
            <Text style={{ color: COLORS.onSurface, fontFamily: FONTS.serif, fontSize: 20 }}>Total à payer</Text>
            <Text style={[TYPE.priceLarge, { color: COLORS.primary }]}>{formatPrice(totalDue)}</Text>
          </View>
          <Text style={{ color: COLORS.outline, fontSize: 11, marginTop: 8, fontFamily: "Inter_400Regular" }}>
            Hors frais de livraison, calculés selon votre zone.
          </Text>
        </View>

        {/* Note + attachments — let the buyer describe their order and join photos. */}
        <View style={{ backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 16, marginBottom: 32, ...SHADOW.card }}>
          <View className="flex-row items-center gap-2 mb-3">
            <MaterialCommunityIcons name="note-text-outline" size={20} color={COLORS.primary} />
            <Text style={{ color: COLORS.onSurface, fontFamily: FONTS.serif, fontSize: 18 }}>
              Note pour votre commande
            </Text>
          </View>
          <Text className="text-xs mb-3" style={{ color: COLORS.outline, fontFamily: "Inter_400Regular" }}>
            Précisez vos besoins (dimensions, finitions, instructions…) et joignez
            des photos si besoin.
          </Text>

          <View
            className="rounded-xl px-4 py-3 mb-3"
            style={{ backgroundColor: COLORS.background, minHeight: 90 }}
          >
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Écrire une note (facultatif)…"
              placeholderTextColor={COLORS.surfaceDim}
              multiline
              editable={!loading}
              style={{
                fontSize: 14,
                color: COLORS.onSurface,
                fontFamily: "Inter_400Regular",
                lineHeight: 20,
                textAlignVertical: "top",
                minHeight: 64,
              }}
            />
          </View>

          {(attachments.length > 0 || uploading) && (
            <View className="flex-row flex-wrap gap-2 mb-3">
              {attachments.map((att, i) => (
                <View key={`${att.url}-${i}`} style={{ width: 60, height: 60 }}>
                  {att.type === "video" ? (
                    <View
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: 10,
                        backgroundColor: COLORS.surfaceContainer,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MaterialCommunityIcons name="play-circle" size={26} color={COLORS.primary} />
                    </View>
                  ) : (
                    <Image
                      source={{ uri: att.url }}
                      style={{ width: 60, height: 60, borderRadius: 10 }}
                      resizeMode="cover"
                    />
                  )}
                  <TouchableOpacity
                    onPress={() =>
                      setAttachments((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    hitSlop={6}
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -6,
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: COLORS.onSurface,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MaterialCommunityIcons name="close" size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {uploading && (
                <View
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 10,
                    backgroundColor: COLORS.surfaceContainer,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ActivityIndicator size="small" color={COLORS.primary} />
                </View>
              )}
            </View>
          )}

          <TouchableOpacity
            onPress={handlePickAttachment}
            disabled={uploading || loading}
            className="flex-row items-center gap-2 self-start rounded-full px-4 py-2"
            style={{ backgroundColor: COLORS.background, opacity: uploading || loading ? 0.6 : 1 }}
          >
            <MaterialCommunityIcons name="paperclip" size={18} color={COLORS.secondary} />
            <Text className="text-sm font-medium" style={{ color: COLORS.secondary, fontFamily: "Inter_500Medium" }}>
              Ajouter une photo
            </Text>
          </TouchableOpacity>
        </View>

        <Button
          label="Payer"
          onPress={handlePayment}
          loading={loading}
          disabled={uploading}
          size="lg"
        />

        <Text className="text-[10px] text-center mt-4" style={{ color: COLORS.outline }}>
          Paiement sécurisé par Stripe. Vos données sont chiffrées.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
