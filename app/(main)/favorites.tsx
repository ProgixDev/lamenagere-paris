import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { COLORS } from "../../lib/constants";
import { priceTagLabel } from "../../lib/pricing";
import { useFavoritesStore } from "../../features/favorites/store";
import { useProductsByIds } from "../../features/products/hooks";
import { getProductImage, CATEGORY_BG } from "../../lib/mock-data";

const { width: W } = Dimensions.get("window");
const CARD_W = (W - 20 * 2 - 12) / 2;

export default function FavoritesScreen() {
  const router = useRouter();
  const favorites = useFavoritesStore((s) => s.favorites);
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);

  const { data: products = [], isLoading } = useProductsByIds(favorites);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={COLORS.onSurface} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontFamily: "Manrope_700Bold", color: COLORS.onSurface }}>
          Mes Favoris
        </Text>
        {products.length > 0 && (
          <View style={{ backgroundColor: `${COLORS.secondary}18`, borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: COLORS.secondary }}>
              {products.length}
            </Text>
          </View>
        )}
      </View>

      {isLoading && favorites.length > 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      ) : products.length > 0 ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {products.map((product, idx) => {
              const img = getProductImage(product.images[0]);
              return (
                <TouchableOpacity
                  key={product.id}
                  activeOpacity={0.92}
                  onPress={() => router.push(`/(main)/products/${product.id}`)}
                  style={{ width: CARD_W, borderRadius: 14, overflow: "hidden", backgroundColor: CATEGORY_BG[idx % CATEGORY_BG.length], marginBottom: 4 }}
                >
                  <TouchableOpacity
                    onPress={async () => {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      toggleFavorite(product.id);
                    }}
                    style={{ position: "absolute", top: 8, right: 8, zIndex: 2, width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.7)", alignItems: "center", justifyContent: "center" }}
                  >
                    <MaterialCommunityIcons name="heart" size={14} color="#E74040" />
                  </TouchableOpacity>
                  {img && <Image source={img} style={{ width: "100%", height: CARD_W * 0.85 }} resizeMode="cover" />}
                  <View style={{ padding: 10 }}>
                    <Text style={{ fontSize: 13, fontFamily: "Manrope_700Bold", color: COLORS.onSurface, marginBottom: 2 }} numberOfLines={1}>{product.name}</Text>
                    <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: COLORS.onSurfaceVariant, marginBottom: 4 }}>par La Ménagère Paris</Text>
                    <Text style={{ fontSize: 14, fontFamily: "Manrope_700Bold", color: COLORS.secondary }}>{priceTagLabel(product)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#f0ebe6", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <MaterialCommunityIcons name="heart-outline" size={32} color={COLORS.secondary} />
          </View>
          <Text style={{ fontSize: 16, fontFamily: "Manrope_700Bold", color: COLORS.onSurface, marginBottom: 6 }}>Aucun favori</Text>
          <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: COLORS.onSurfaceVariant, textAlign: "center", marginBottom: 20 }}>
            Sauvegardez vos coups de cœur{"\n"}pour les retrouver facilement
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/categories")}
            style={{ borderWidth: 1, borderColor: `${COLORS.outlineVariant}33`, borderRadius: 9999, paddingHorizontal: 20, paddingVertical: 10 }}
          >
            <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: COLORS.secondary }}>Découvrir nos collections</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
