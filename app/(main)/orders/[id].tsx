import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../../lib/constants";
import { formatDate, formatPrice } from "../../../lib/utils";
import Skeleton from "../../../components/ui/Skeleton";
import OrderTimeline from "../../../components/order/OrderTimeline";
import Button from "../../../components/ui/Button";
import Card from "../../../components/ui/Card";
import {
  useOrder,
  useCancelOrder,
  useRequestRefund,
} from "../../../features/orders/hooks";
import { summarizeConfiguration } from "../../../lib/config-blocks";
import type { RefundStatus } from "../../../lib/types";

const CANCELLABLE_STATUSES = ["commande_confirmee", "en_preparation"];

const REFUND_BANNER: Record<
  Exclude<RefundStatus, "none">,
  { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; tone: string }
> = {
  requested: {
    icon: "clock-outline",
    title: "Remboursement en cours d'examen",
    tone: COLORS.secondary,
  },
  refunded: {
    icon: "check-circle-outline",
    title: "Remboursement effectué",
    tone: "#1B873F",
  },
  rejected: {
    icon: "close-circle-outline",
    title: "Demande de remboursement refusée",
    tone: COLORS.error,
  },
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: order, isLoading } = useOrder(id);
  const cancelOrder = useCancelOrder();
  const requestRefund = useRequestRefund(id);
  const [refundModal, setRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState("");

  const submitRefund = () => {
    requestRefund.mutate(refundReason.trim() || undefined, {
      onSuccess: () => {
        setRefundModal(false);
        setRefundReason("");
      },
      onError: (e: any) =>
        Alert.alert(
          "Erreur",
          e?.response?.data?.message ||
            e?.message ||
            "Impossible d'envoyer la demande de remboursement",
        ),
    });
  };

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

        {order.refundStatus && order.refundStatus !== "none" && (
          <View
            className="rounded-xl p-4 flex-row gap-3"
            style={{ backgroundColor: COLORS.surfaceContainerLow }}
          >
            <MaterialCommunityIcons
              name={REFUND_BANNER[order.refundStatus].icon}
              size={22}
              color={REFUND_BANNER[order.refundStatus].tone}
            />
            <View className="flex-1">
              <Text
                className="text-sm font-semibold"
                style={{ color: REFUND_BANNER[order.refundStatus].tone, fontFamily: "Manrope_700Bold" }}
              >
                {REFUND_BANNER[order.refundStatus].title}
              </Text>
              {order.refundStatus === "refunded" && order.refundAmount != null && (
                <Text className="text-xs mt-1" style={{ color: COLORS.onSurfaceVariant }}>
                  {formatPrice(order.refundAmount)} remboursés sur votre moyen de paiement.
                </Text>
              )}
              {order.refundStatus === "rejected" && order.refundDecisionNote && (
                <Text className="text-xs mt-1" style={{ color: COLORS.onSurfaceVariant }}>
                  {order.refundDecisionNote}
                </Text>
              )}
              {order.refundStatus === "requested" && (
                <Text className="text-xs mt-1" style={{ color: COLORS.onSurfaceVariant }}>
                  Votre demande a bien été transmise. Nous reviendrons vers vous rapidement.
                </Text>
              )}
            </View>
          </View>
        )}

        <Card padding="lg">
          <OrderTimeline timeline={order.timeline} />
        </Card>

        {/* Items */}
        <Card padding="lg">
          <Text className="text-sm font-semibold mb-3" style={{ color: COLORS.onSurface }}>Articles</Text>
          {order.items.map((item) => {
            const summary = item.configuration?.length
              ? summarizeConfiguration(item.configuration)
              : "";
            return (
              <View key={item.id} className="flex-row justify-between mb-2">
                <View className="flex-1 pr-2">
                  <Text className="text-sm" style={{ color: COLORS.onSurface }} numberOfLines={1}>
                    {item.product.name} x{item.quantity}
                  </Text>
                  {summary ? (
                    <Text className="text-xs mt-0.5" style={{ color: COLORS.outline }} numberOfLines={2}>
                      {summary}
                    </Text>
                  ) : null}
                </View>
                <Text className="text-sm" style={{ color: COLORS.secondary }}>
                  {formatPrice(item.price * item.quantity)}
                </Text>
              </View>
            );
          })}
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

        {order.paymentStatus === "paid" &&
          (!order.refundStatus || order.refundStatus === "none") && (
            <Button
              label="DEMANDER UN REMBOURSEMENT"
              onPress={() => setRefundModal(true)}
              variant="secondary"
              size="lg"
            />
          )}
      </ScrollView>

      {/* Refund reason modal */}
      <Modal
        visible={refundModal}
        transparent
        animationType="fade"
        onRequestClose={() => setRefundModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: "center",
            paddingHorizontal: 24,
          }}
        >
          <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 20 }}>
            <Text
              className="text-base font-semibold mb-2"
              style={{ color: COLORS.onSurface, fontFamily: "Manrope_700Bold" }}
            >
              Demander un remboursement
            </Text>
            <Text className="text-xs mb-3" style={{ color: COLORS.onSurfaceVariant }}>
              Expliquez-nous brièvement la raison (facultatif). Notre équipe
              examinera votre demande.
            </Text>
            <View
              className="rounded-xl px-4 py-3 mb-4"
              style={{ backgroundColor: COLORS.surfaceContainerLow, minHeight: 90 }}
            >
              <TextInput
                value={refundReason}
                onChangeText={setRefundReason}
                placeholder="Motif du remboursement…"
                placeholderTextColor={COLORS.surfaceDim}
                multiline
                editable={!requestRefund.isPending}
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
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Button
                  label="Annuler"
                  onPress={() => setRefundModal(false)}
                  variant="secondary"
                  disabled={requestRefund.isPending}
                />
              </View>
              <View className="flex-1">
                <Button
                  label="Envoyer"
                  onPress={submitRefund}
                  loading={requestRefund.isPending}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
