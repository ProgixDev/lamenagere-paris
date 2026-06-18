import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../lib/constants";
import { useCart } from "../../features/cart/hooks";
import CartItemComponent from "../../components/cart/CartItem";
import CartSummary from "../../components/cart/CartSummary";
import Button from "../../components/ui/Button";
import LogoHeader from "../../components/layout/LogoHeader";
import { useAuthStore } from "../../features/auth/store";

export default function CartScreen() {
  const router = useRouter();
  const { items, itemCount, subtotal, removeItem, updateQuantity, clearCart } = useCart();
  const isB2b = useAuthStore((s) => s.user?.accountType === "professionnel");

  const handleClear = () => {
    Alert.alert(
      "Vider le panier",
      "Supprimer tous les articles ?",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Vider", style: "destructive", onPress: () => clearCart() },
      ],
    );
  };

  // ── Empty state ──
  if (items.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
        <LogoHeader />

        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: "#f0ebe6",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <MaterialCommunityIcons name="shopping-outline" size={36} color={COLORS.secondary} />
          </View>
          <Text
            style={{
              fontSize: 18,
              fontFamily: "Manrope_700Bold",
              color: COLORS.onSurface,
              marginBottom: 6,
            }}
          >
            Votre panier est vide
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontFamily: "Inter_400Regular",
              color: COLORS.onSurfaceVariant,
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            Explorez nos collections et ajoutez{"\n"}vos coups de cœur
          </Text>
          <Button
            label="Explorer le catalogue"
            onPress={() => router.push("/(tabs)/categories")}
            variant="secondary"
            size="md"
            fullWidth={false}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ── Cart with items ──
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <LogoHeader />
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 12,
        }}
      >
        <Text style={{ fontSize: 20, fontFamily: "Manrope_700Bold", color: COLORS.onSurface }}>
          Mon Panier
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View
            style={{
              backgroundColor: COLORS.primary,
              borderRadius: 10,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff" }}>
              {itemCount}
            </Text>
          </View>
          <TouchableOpacity onPress={handleClear} style={{ padding: 4, marginLeft: 8 }}>
            <MaterialCommunityIcons name="trash-can-outline" size={20} color={COLORS.outline} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140, gap: 12 }}
      >
        {items.map((item) => (
          <CartItemComponent
            key={item.id}
            item={item}
            onUpdateQuantity={(qty) => updateQuantity(item.id, qty)}
            onRemove={() => removeItem(item.id)}
          />
        ))}

        <View style={{ marginTop: 8 }}>
          <CartSummary subtotal={subtotal} total={subtotal} isB2b={isB2b} />
        </View>
      </ScrollView>

      {/* Fixed bottom CTA */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: COLORS.background,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 100,
          borderTopWidth: 1,
          borderTopColor: "#f0f0f0",
        }}
      >
        <Button
          label="Passer la commande"
          onPress={() => router.push("/(main)/checkout")}
          size="md"
        />
      </View>
    </SafeAreaView>
  );
}
