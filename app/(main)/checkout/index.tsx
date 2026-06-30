import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS, DELIVERY_ESTIMATES } from "../../../lib/constants";
import { FONTS, TYPE, SHADOW } from "../../../lib/typography";
import {
  isOverseas,
  formatPrice,
  territoryFromPostalCode,
} from "../../../lib/utils";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import CheckoutSteps from "../../../components/cart/CheckoutSteps";
import { useCart } from "../../../features/cart/hooks";
import { useCheckoutStore, type DeliveryAddress } from "../../../features/checkout/store";
import { useAuthStore } from "../../../features/auth/store";

export default function CheckoutAddressScreen() {
  const router = useRouter();
  const { items, subtotal } = useCart();
  const setDeliveryAddress = useCheckoutStore((s) => s.setDeliveryAddress);
  const saved = useCheckoutStore((s) => s.address);
  const savedProfile = useAuthStore((s) => s.user?.deliveryAddress);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  // Pre-fill from the in-session address, else the one saved on the profile.
  const [form, setForm] = useState<DeliveryAddress>(
    saved ??
      savedProfile ?? {
        firstName: "",
        lastName: "",
        street: "",
        postalCode: "",
        city: "",
        phone: "",
      },
  );
  const patch = (p: Partial<DeliveryAddress>) => setForm((f) => ({ ...f, ...p }));

  const territory = territoryFromPostalCode(form.postalCode);
  const overseas = isOverseas(territory);
  const valid =
    form.firstName.trim() &&
    form.lastName.trim() &&
    form.street.trim() &&
    form.postalCode.trim().length >= 4 &&
    form.city.trim();

  const onContinue = () => {
    if (!valid) return;
    const address = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      street: form.street.trim(),
      postalCode: form.postalCode.trim(),
      city: form.city.trim(),
      phone: form.phone?.trim() || undefined,
    };
    setDeliveryAddress(address, territory);
    // Remember it on the profile so it pre-fills next time (best-effort).
    updateProfile({ deliveryAddress: address }).catch(() => {});
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

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <CheckoutSteps currentStep={1} />

        <Text style={{ fontFamily: FONTS.serif, fontSize: 20, color: COLORS.onSurface, marginBottom: 16, marginTop: 8 }}>
          Adresse de livraison
        </Text>

        <View style={{ backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 16, gap: 14, marginBottom: 24, ...SHADOW.card }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Input label="PRÉNOM" value={form.firstName} onChangeText={(t) => patch({ firstName: t })} />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="NOM" value={form.lastName} onChangeText={(t) => patch({ lastName: t })} />
            </View>
          </View>
          <Input label="ADRESSE" value={form.street} onChangeText={(t) => patch({ street: t })} />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ width: 130 }}>
              <Input label="CODE POSTAL" value={form.postalCode} onChangeText={(t) => patch({ postalCode: t })} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="VILLE" value={form.city} onChangeText={(t) => patch({ city: t })} />
            </View>
          </View>
          <Input label="TÉLÉPHONE" value={form.phone ?? ""} onChangeText={(t) => patch({ phone: t })} keyboardType="phone-pad" />
        </View>

        {/* Inferred delivery zone */}
        {form.postalCode.trim().length >= 2 && (
          <View className="rounded-xl p-4 mb-6 flex-row gap-3" style={{ backgroundColor: COLORS.surfaceContainerLow }}>
            <MaterialCommunityIcons name={overseas ? "ferry" : "truck-outline"} size={20} color={COLORS.secondary} />
            <Text className="flex-1 text-xs" style={{ color: COLORS.onSurfaceVariant, lineHeight: 18 }}>
              {overseas
                ? `Livraison par conteneur maritime : ${DELIVERY_ESTIMATES.OUTRE_MER}. Une équipe dédiée gérera votre expédition.`
                : `Livraison en France métropolitaine : ${DELIVERY_ESTIMATES.METROPOLE}.`}
            </Text>
          </View>
        )}

        {/* Summary */}
        <View style={{ backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 16, marginBottom: 24, ...SHADOW.card }}>
          {items.map((item) => (
            <View key={item.id} className="flex-row justify-between mb-2">
              <Text className="text-xs flex-1" style={{ color: COLORS.onSurface }} numberOfLines={1}>
                {item.product.name} x{item.quantity}
              </Text>
              <Text className="text-xs" style={{ color: COLORS.onSurface }}>
                {formatPrice((item.calculatedPrice || item.product.price || 0) * item.quantity)}
              </Text>
            </View>
          ))}
          <View className="flex-row justify-between items-center mt-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: COLORS.outlineVariant }}>
            <Text style={{ color: COLORS.onSurface, fontFamily: FONTS.serif, fontSize: 18 }}>Total TTC</Text>
            <Text style={[TYPE.price, { color: COLORS.primary }]}>{formatPrice(subtotal)}</Text>
          </View>
        </View>

        <Button label="Continuer vers le paiement →" onPress={onContinue} size="lg" disabled={!valid} />
      </ScrollView>
    </SafeAreaView>
  );
}
