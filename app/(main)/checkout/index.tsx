import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS, DELIVERY_ESTIMATES } from "../../../lib/constants";
import { isOverseas, formatPrice } from "../../../lib/utils";
import Button from "../../../components/ui/Button";
import CheckoutSteps from "../../../components/cart/CheckoutSteps";
import AddressFormModal from "../../../components/address/AddressFormModal";
import { useCart } from "../../../features/cart/hooks";
import {
  useAddresses,
  useCreateAddress,
} from "../../../features/addresses/hooks";
import type { AddressInput } from "../../../features/addresses/api";
import { useCheckoutStore } from "../../../features/checkout/store";

export default function CheckoutAddressScreen() {
  const router = useRouter();
  const { items, subtotal } = useCart();
  const { data: addresses = [], isLoading } = useAddresses();
  const createAddress = useCreateAddress();
  const setAddress = useCheckoutStore((s) => s.setAddress);
  const selectedId = useCheckoutStore((s) => s.shippingAddressId);

  const [modalVisible, setModalVisible] = useState(false);

  // Default-select the user's default address (or first) once loaded.
  useEffect(() => {
    if (!selectedId && addresses.length > 0) {
      const preferred =
        addresses.find((a) => a.isDefault) ?? addresses[0];
      setAddress(preferred.id, preferred.territory);
    }
  }, [addresses, selectedId, setAddress]);

  const selected = addresses.find((a) => a.id === selectedId) ?? null;
  const overseas = selected ? isOverseas(selected.territory) : false;

  const handleCreate = (payload: AddressInput) => {
    createAddress.mutate(payload, {
      onSuccess: (created) => {
        setModalVisible(false);
        setAddress(created.id, created.territory);
      },
    });
  };

  const onContinue = () => {
    if (!selected) return;
    setAddress(selected.id, selected.territory);
    router.push("/(main)/checkout/shipping");
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
        <CheckoutSteps currentStep={1} />

        <Text className="text-sm font-semibold mb-6" style={{ color: COLORS.onSurface }}>
          Adresse de livraison
        </Text>

        {isLoading ? (
          <View style={{ alignItems: "center", paddingVertical: 40 }}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : addresses.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 24, marginBottom: 16 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#f0ebe6", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <MaterialCommunityIcons name="map-marker-outline" size={28} color={COLORS.secondary} />
            </View>
            <Text style={{ fontSize: 15, fontFamily: "Manrope_700Bold", color: COLORS.onSurface, marginBottom: 4 }}>
              Aucune adresse
            </Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: COLORS.onSurfaceVariant, textAlign: "center", marginBottom: 16 }}>
              Ajoutez une adresse pour continuer
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12, marginBottom: 16 }}>
            {addresses.map((addr) => {
              const active = addr.id === selectedId;
              return (
                <TouchableOpacity
                  key={addr.id}
                  activeOpacity={0.9}
                  onPress={() => setAddress(addr.id, addr.territory)}
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: 14,
                    padding: 16,
                    borderWidth: 1.5,
                    borderColor: active ? COLORS.primary : `${COLORS.outlineVariant}33`,
                    flexDirection: "row",
                    gap: 12,
                  }}
                >
                  <MaterialCommunityIcons
                    name={active ? "radiobox-marked" : "radiobox-blank"}
                    size={22}
                    color={active ? COLORS.primary : COLORS.outline}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: COLORS.onSurface, marginBottom: 4 }}>
                      {addr.firstName} {addr.lastName}
                    </Text>
                    <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: COLORS.onSurfaceVariant, lineHeight: 20 }}>
                      {addr.street}{"\n"}{addr.postalCode} {addr.city}
                    </Text>
                    {addr.isDefault && (
                      <View style={{ marginTop: 8, alignSelf: "flex-start", backgroundColor: `${COLORS.primary}12`, borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 3 }}>
                        <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: COLORS.primary }}>Par défaut</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Add address button */}
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            backgroundColor: "#ffffff",
            borderRadius: 14,
            paddingVertical: 16,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: `${COLORS.outlineVariant}66`,
            marginBottom: 16,
          }}
        >
          <MaterialCommunityIcons name="plus" size={20} color={COLORS.secondary} />
          <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: COLORS.secondary }}>
            Ajouter une adresse
          </Text>
        </TouchableOpacity>

        {/* Shipping zone info */}
        {selected && (
          <View className="rounded-xl p-6 mb-6" style={{ backgroundColor: COLORS.surfaceContainerLow }}>
            <Text className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: COLORS.outline }}>
              ZONE DE LIVRAISON
            </Text>
            <Text className="text-sm" style={{ color: overseas ? COLORS.onSurfaceVariant : COLORS.onSurface }}>
              {overseas
                ? `Livraison par conteneur maritime : ${DELIVERY_ESTIMATES.OUTRE_MER}`
                : `Livraison en France métropolitaine : ${DELIVERY_ESTIMATES.METROPOLE}`}
            </Text>
            {overseas && (
              <Text className="text-xs mt-1" style={{ color: COLORS.onSurfaceVariant }}>
                Une équipe dédiée gérera votre expédition.
              </Text>
            )}
          </View>
        )}

        {/* Summary */}
        <View className="rounded-xl p-4 mb-6" style={{ backgroundColor: COLORS.surfaceContainer }}>
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
          <View className="flex-row justify-between mt-2 pt-2" style={{ borderTopWidth: 1, borderTopColor: COLORS.surfaceContainerLow }}>
            <Text className="font-bold" style={{ color: COLORS.secondary, fontFamily: "Manrope_700Bold" }}>
              Total TTC
            </Text>
            <Text className="font-bold" style={{ color: COLORS.secondary, fontFamily: "Manrope_700Bold" }}>
              {formatPrice(subtotal)}
            </Text>
          </View>
        </View>

        <Button
          label="Continuer vers la livraison →"
          onPress={onContinue}
          size="lg"
          disabled={!selected}
        />
      </ScrollView>

      <AddressFormModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSubmit={handleCreate}
        loading={createAddress.isPending}
      />
    </SafeAreaView>
  );
}
