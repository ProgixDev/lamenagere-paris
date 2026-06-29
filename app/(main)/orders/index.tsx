import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../../lib/constants";
import { formatPrice, formatDate } from "../../../lib/utils";
import { getProductImage } from "../../../lib/mock-data";
import { useOrders } from "../../../features/orders/hooks";
import { ORDER_STATUS_LABELS } from "../../../features/orders/store";
import { useQuoteRequests } from "../../../features/quotes/hooks";
import { useCartStore } from "../../../features/cart/store";
import type { QuoteStatus } from "../../../lib/types";

const STATUS_COLORS: Record<string, string> = {
  commande_confirmee: COLORS.primary,
  en_preparation: COLORS.primary,
  en_attente_expedition: COLORS.warning,
  expediee: COLORS.secondary,
  livree: COLORS.success,
};

const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  en_attente_devis: "En attente",
  devis_envoye: "Devis envoyé",
  devis_accepte: "Accepté",
  devis_rejete: "Refusé",
};

const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  en_attente_devis: COLORS.secondary,
  devis_envoye: COLORS.primary,
  devis_accepte: COLORS.success,
  devis_rejete: COLORS.error,
};

type Tab = "orders" | "quotes";

export default function OrdersScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("orders");
  const { data: orders = [], isLoading: ordersLoading } = useOrders();
  const { data: quotes = [], isLoading: quotesLoading } = useQuoteRequests();
  const addQuoteItem = useCartStore((s) => s.addQuoteItem);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 12,
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={COLORS.onSurface} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontFamily: "Manrope_700Bold", color: COLORS.onSurface }}>
          Mes Commandes
        </Text>
      </View>

      {/* Tabs */}
      <View style={{ flexDirection: "row", paddingHorizontal: 20, gap: 8, marginBottom: 16 }}>
        {([
          { key: "orders" as Tab, label: "Commandes", count: orders.length },
          { key: "quotes" as Tab, label: "Devis", count: quotes.length },
        ]).map((t) => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 9999,
              backgroundColor: tab === t.key ? COLORS.primary : "#ffffff",
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontFamily: tab === t.key ? "Inter_600SemiBold" : "Inter_500Medium",
                color: tab === t.key ? "#ffffff" : COLORS.onSurfaceVariant,
              }}
            >
              {t.label}
            </Text>
            <View
              style={{
                minWidth: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: tab === t.key ? "rgba(255,255,255,0.25)" : "#f0f0f0",
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 5,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: "Inter_600SemiBold",
                  color: tab === t.key ? "#ffffff" : COLORS.outline,
                }}
              >
                {t.count}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12 }}>
        {tab === "orders" ? (
          ordersLoading ? (
            <LoadingBlock />
          ) : orders.length > 0 ? (
            orders.map((order) => {
              const firstItem = order.items[0];
              const img = firstItem ? getProductImage(firstItem.product.images[0]) : null;
              const statusColor = STATUS_COLORS[order.status] ?? COLORS.primary;
              return (
                <TouchableOpacity
                  key={order.id}
                  activeOpacity={0.9}
                  onPress={() => router.push(`/(main)/orders/${order.id}`)}
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: 14,
                    padding: 14,
                    flexDirection: "row",
                    gap: 14,
                  }}
                >
                  {img && (
                    <Image source={img} style={{ width: 72, height: 72, borderRadius: 10 }} resizeMode="cover" />
                  )}
                  <View style={{ flex: 1, justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: COLORS.onSurface }}>
                        #{order.orderNumber}
                      </Text>
                      <View style={{ backgroundColor: `${statusColor}18`, borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: statusColor }}>
                          {ORDER_STATUS_LABELS[order.status]}
                        </Text>
                      </View>
                    </View>
                    {firstItem && (
                      <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: COLORS.onSurface }} numberOfLines={1}>
                        {firstItem.product.name}
                      </Text>
                    )}
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ fontSize: 14, fontFamily: "Manrope_700Bold", color: COLORS.secondary }}>
                        {formatPrice(order.total)}
                      </Text>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: COLORS.outline }}>
                        {formatDate(order.createdAt)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <EmptyBlock icon="package-variant-closed" title="Aucune commande" message="Vos commandes apparaîtront ici" />
          )
        ) : quotesLoading ? (
          <LoadingBlock />
        ) : quotes.length > 0 ? (
          quotes.map((quote) => {
            const img = getProductImage(quote.product.images[0]);
            const statusColor = QUOTE_STATUS_COLORS[quote.status] ?? COLORS.secondary;
            const canAddToCart =
              quote.quotedPrice != null &&
              (quote.status === "devis_envoye" || quote.status === "devis_accepte");
            return (
              <View
                key={quote.id}
                style={{ backgroundColor: "#ffffff", borderRadius: 14, padding: 14 }}
              >
                <View style={{ flexDirection: "row", gap: 14 }}>
                  {img && (
                    <Image source={img} style={{ width: 72, height: 72, borderRadius: 10 }} resizeMode="cover" />
                  )}
                  <View style={{ flex: 1, justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: COLORS.onSurface }} numberOfLines={1}>
                        {quote.product.name}
                      </Text>
                      <View style={{ backgroundColor: `${statusColor}18`, borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: statusColor }}>
                          {QUOTE_STATUS_LABELS[quote.status]}
                        </Text>
                      </View>
                    </View>
                    {quote.quotedPrice != null && (
                      <Text style={{ fontSize: 14, fontFamily: "Manrope_700Bold", color: COLORS.secondary }}>
                        {formatPrice(quote.quotedPrice)}
                      </Text>
                    )}
                    <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: COLORS.outline }}>
                      {formatDate(quote.createdAt)}
                    </Text>
                  </View>
                </View>

                {canAddToCart && (
                  <TouchableOpacity
                    onPress={() => {
                      addQuoteItem(quote.product, quote.quotedPrice as number, quote.id);
                      router.push("/(tabs)/cart");
                    }}
                    activeOpacity={0.85}
                    style={{
                      marginTop: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      backgroundColor: COLORS.primary,
                      borderRadius: 10,
                      paddingVertical: 11,
                    }}
                  >
                    <MaterialCommunityIcons name="cart-plus" size={18} color={COLORS.onPrimary} />
                    <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: COLORS.onPrimary }}>
                      Ajouter au panier
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        ) : (
          <EmptyBlock icon="file-document-outline" title="Aucun devis" message="Vos demandes de devis apparaîtront ici" />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function LoadingBlock() {
  return (
    <View style={{ alignItems: "center", paddingTop: 60 }}>
      <ActivityIndicator color={COLORS.primary} />
    </View>
  );
}

function EmptyBlock({ icon, title, message }: { icon: string; title: string; message: string }) {
  return (
    <View style={{ alignItems: "center", paddingTop: 60, paddingHorizontal: 20 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#f0ebe6", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
        <MaterialCommunityIcons name={icon as any} size={28} color={COLORS.secondary} />
      </View>
      <Text style={{ fontSize: 16, fontFamily: "Manrope_700Bold", color: COLORS.onSurface, marginBottom: 4 }}>{title}</Text>
      <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: COLORS.onSurfaceVariant, textAlign: "center" }}>{message}</Text>
    </View>
  );
}
