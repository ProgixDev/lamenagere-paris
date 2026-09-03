import React from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import EmptyState from "../../components/ui/EmptyState";
import { COLORS } from "../../lib/constants";
import { TYPE, SHADOW } from "../../lib/typography";
import { formatPrice, formatDate } from "../../lib/utils";
import { useOrders } from "../../features/orders/hooks";
import GuestGate from "../../components/GuestGate";
import { useIsGuestVisitor } from "../../features/auth/guards";

function PaymentsInvoicesScreenContent() {
  const router = useRouter();
  const { data: orders = [], isLoading } = useOrders();
  const paidOrders = orders.filter((o) => o.paymentStatus === "paid");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 16,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Retour">
          <MaterialCommunityIcons name="chevron-left" size={26} color={COLORS.onSurface} />
        </TouchableOpacity>
        <Text style={TYPE.screenTitle}>Paiements & factures</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12, flexGrow: 1 }}
      >
        {isLoading ? (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : paidOrders.length > 0 ? (
          paidOrders.map((order) => (
            <TouchableOpacity
              key={order.id}
              activeOpacity={0.9}
              onPress={() => router.push(`/(main)/orders/${order.id}`)}
              style={{
                backgroundColor: COLORS.surfaceContainerLowest,
                borderRadius: 16,
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                ...SHADOW.card,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: `${COLORS.success}18`,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialCommunityIcons name="receipt" size={22} color={COLORS.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: COLORS.onSurface }}>
                  #{order.orderNumber}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.outline, marginTop: 2 }}>
                  {formatDate(order.createdAt)}
                </Text>
              </View>
              <Text style={[TYPE.price, { fontSize: 16 }]}>{formatPrice(order.total)}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.outline} />
            </TouchableOpacity>
          ))
        ) : (
          <EmptyState
            icon="receipt-outline"
            title="Aucune facture pour le moment"
            message="Vos paiements confirmés et leurs factures apparaîtront ici."
            action={{ label: "Explorer le catalogue", onPress: () => router.push("/(tabs)/categories") }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Personal financial history — same guard as the orders list: guests browse
 * freely, but this needs a signed-in account.
 */
export default function PaymentsInvoicesScreen() {
  const isGuestVisitor = useIsGuestVisitor();
  if (isGuestVisitor) {
    return (
      <GuestGate
        icon="receipt-outline"
        title="Paiements & factures"
        message="Connectez-vous pour retrouver vos paiements et télécharger vos factures."
      />
    );
  }
  return <PaymentsInvoicesScreenContent />;
}
