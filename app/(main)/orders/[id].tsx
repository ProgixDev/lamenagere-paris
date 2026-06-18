import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../../lib/constants";
import { formatDate, formatPrice } from "../../../lib/utils";
import Skeleton from "../../../components/ui/Skeleton";
import OrderTimeline from "../../../components/order/OrderTimeline";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import { useOrder, useCancelOrder } from "../../../features/orders/hooks";

const CANCELLABLE_STATUSES = ["commande_confirmee", "en_preparation"];

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: order, isLoading } = useOrder(id);
  const cancelOrder = useCancelOrder();

  const handleCancel = () => {
    if (!order) return;
    Alert.alert(
      "Annuler la commande",
      "Voulez-vous vraiment annuler cette commande ?",
      [
        { text: "Non", style: "cancel" },
        {
          text: "Annuler la commande",
          style: "destructive",
          onPress: () =>
            cancelOrder.mutate(order.id, {
              onError: (e: any) =>
                Alert.alert(
                  "Erreur",
                  e?.message || "Impossible d'annuler la commande",
                ),
            }),
        },
      ],
    );
  };

  if (isLoading || !order) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
        <View className="px-6 py-4">
          <Skeleton height={20} width="50%" />
        </View>
        <View className="px-6 gap-4">
          <Skeleton height={200} borderRadius={8} />
          <Skeleton height={16} width="60%" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View className="px-6 py-4 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text className="text-lg font-semibold" style={{ color: COLORS.primaryContainer, fontFamily: "Manrope_700Bold" }}>
          Détails de la commande
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, gap: 24 }}>
        <View>
          <Text className="text-lg" style={{ color: COLORS.onSurface, fontFamily: "Manrope_700Bold" }}>
            {order.orderNumber}
          </Text>
          <Text className="text-xs mt-1" style={{ color: COLORS.outline }}>
            {formatDate(order.createdAt)}
          </Text>
        </View>

        <Card padding="lg">
          <OrderTimeline timeline={order.timeline} />
        </Card>

        {/* Items */}
        <Card padding="lg">
          <Text className="text-sm font-semibold mb-3" style={{ color: COLORS.onSurface }}>Articles</Text>
          {order.items.map((item) => (
            <View key={item.id} className="flex-row justify-between mb-2">
              <Text className="text-sm flex-1" style={{ color: COLORS.onSurface }} numberOfLines={1}>
                {item.product.name} x{item.quantity}
              </Text>
              <Text className="text-sm" style={{ color: COLORS.secondary }}>
                {formatPrice(item.price * item.quantity)}
              </Text>
            </View>
          ))}
        </Card>

        {/* Address */}
        <Card padding="lg">
          <Text className="text-sm font-semibold mb-3" style={{ color: COLORS.onSurface }}>Adresse de livraison</Text>
          <Text className="text-sm" style={{ color: COLORS.onSurfaceVariant }}>
            {order.shippingAddress.firstName} {order.shippingAddress.lastName}
          </Text>
          <Text className="text-sm" style={{ color: COLORS.onSurfaceVariant }}>
            {order.shippingAddress.street}
          </Text>
          <Text className="text-sm" style={{ color: COLORS.onSurfaceVariant }}>
            {order.shippingAddress.postalCode} {order.shippingAddress.city}
          </Text>
        </Card>

        {/* Total */}
        <Card padding="lg">
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm" style={{ color: COLORS.onSurface }}>Sous-total</Text>
            <Text className="text-sm" style={{ color: COLORS.onSurface }}>{formatPrice(order.subtotal)}</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm" style={{ color: COLORS.outline }}>Livraison</Text>
            <Text className="text-sm" style={{ color: COLORS.outline }}>{formatPrice(order.shippingCost)}</Text>
          </View>
          <View className="flex-row justify-between mt-2 pt-2" style={{ borderTopWidth: 1, borderTopColor: COLORS.surfaceContainerLow }}>
            <Text className="font-bold" style={{ color: COLORS.primary, fontFamily: "Manrope_800ExtraBold" }}>Total</Text>
            <Text className="text-lg font-bold" style={{ color: COLORS.secondary, fontFamily: "Manrope_700Bold" }}>{formatPrice(order.total)}</Text>
          </View>
        </Card>

        <Button label="CONTACTER LE VENDEUR" onPress={() => router.push("/(tabs)/messages")} variant="secondary" size="lg" />

        {CANCELLABLE_STATUSES.includes(order.status) && (
          <Button
            label="ANNULER LA COMMANDE"
            onPress={handleCancel}
            variant="danger"
            size="lg"
            loading={cancelOrder.isPending}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
