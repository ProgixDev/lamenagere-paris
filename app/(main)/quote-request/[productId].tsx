import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image as RNImage } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { COLORS } from "../../../lib/constants";
import { openingTypeLabel, diagramForTypes } from "../../../lib/opening-types";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";
import { useProduct } from "../../../features/products/hooks";
import { useCreateQuote } from "../../../features/quotes/hooks";

export default function QuoteRequestScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const router = useRouter();
  const { data: product } = useProduct(productId);
  const createQuote = useCreateQuote();

  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [notes, setNotes] = useState("");
  const [openingType, setOpeningType] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [sent, setSent] = useState(false);

  const openingTypes = product?.openingTypes ?? [];

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 5 - images.length,
    });
    if (!result.canceled) {
      setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)].slice(0, 5));
    }
  };

  const handleSubmit = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await createQuote.mutateAsync({
        productId,
        dimensions: width && height ? { width: parseFloat(width), height: parseFloat(height) } : undefined,
        notes: notes || undefined,
        openingType: openingType || undefined,
        images: images.length > 0 ? images : undefined,
      });
      setSent(true);
    } catch {
      // error handled by mutation
    }
  };

  if (sent) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
        <View className="flex-1 items-center justify-center px-6">
          <View
            className="w-16 h-16 rounded-full items-center justify-center mb-6"
            style={{ backgroundColor: COLORS.primary }}
          >
            <MaterialCommunityIcons name="check" size={32} color="#fff" />
          </View>
          <Text className="text-xl mb-2" style={{ color: COLORS.primary, fontFamily: "Manrope_700Bold" }}>
            Demande envoyée !
          </Text>
          <Text className="text-sm text-center mb-8" style={{ color: COLORS.onSurfaceVariant }}>
            Votre devis sera prêt sous 48h.
          </Text>
          <Button label="Suivre ma demande" onPress={() => router.replace("/(main)/orders")} variant="secondary" />
          <View className="mt-4 w-full">
            <Button label="Retour à l'accueil" onPress={() => router.replace("/(tabs)")} />
          </View>
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
          Demander un devis
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, gap: 24 }}>
        {/* Product reference */}
        {product && (
          <View className="rounded-xl p-4 flex-row gap-3" style={{ backgroundColor: COLORS.surfaceContainerLow }}>
            <View className="w-16 h-16 rounded-lg" style={{ backgroundColor: COLORS.surfaceContainer }} />
            <View className="flex-1">
              <Text className="text-sm font-semibold" style={{ color: COLORS.onSurface }}>{product.name}</Text>
              <Text className="text-xs italic" style={{ color: COLORS.secondary }}>Prix sur devis</Text>
            </View>
          </View>
        )}

        {/* Dimensions */}
        <View>
          <Text className="text-[10px] uppercase tracking-widest font-semibold mb-3" style={{ color: COLORS.outline }}>
            DIMENSIONS SOUHAITÉES
          </Text>
          <View className="flex-row gap-4">
            <View className="flex-1">
              <Input label="LARGEUR" value={width} onChangeText={setWidth} keyboardType="numeric" suffix="cm" />
            </View>
            <View className="flex-1">
              <Input label="HAUTEUR" value={height} onChangeText={setHeight} keyboardType="numeric" suffix="cm" />
            </View>
          </View>
        </View>

        {/* Opening type */}
        {openingTypes.length > 0 && (
          <View>
            <Text className="text-[10px] uppercase tracking-widest font-semibold mb-3" style={{ color: COLORS.outline }}>
              TYPE D'OUVERTURE
            </Text>
            {(() => {
              const diagram = diagramForTypes(openingTypes.map((o) => o.type));
              return diagram ? (
                <RNImage
                  source={diagram}
                  style={{ width: "100%", height: 140, borderRadius: 12, marginBottom: 12, backgroundColor: COLORS.surfaceContainer }}
                  resizeMode="contain"
                />
              ) : null;
            })()}
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {openingTypes.map((opt) => {
                const active = openingType === opt.type;
                return (
                  <TouchableOpacity
                    key={opt.type}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setOpeningType(opt.type);
                    }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                      borderRadius: 9999,
                      backgroundColor: active ? COLORS.primary : "transparent",
                      borderWidth: 1,
                      borderColor: active ? COLORS.primary : COLORS.outlineVariant,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontFamily: active ? "Inter_600SemiBold" : "Inter_500Medium", color: active ? COLORS.onPrimary : COLORS.onSurface }}>
                      {openingTypeLabel(opt.type)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Notes */}
        <Input
          label="NOTES ET PRÉCISIONS"
          placeholder="Décrivez votre projet, contraintes techniques..."
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
        />

        {/* Photos */}
        <View>
          <Text className="text-[10px] uppercase tracking-widest font-semibold mb-3" style={{ color: COLORS.outline }}>
            INSPIRATION ET ESPACE ACTUEL
          </Text>
          <TouchableOpacity
            onPress={pickImage}
            className="rounded-xl py-6 items-center"
            style={{ borderWidth: 1, borderColor: `${COLORS.outlineVariant}33`, borderStyle: "dashed" }}
          >
            <MaterialCommunityIcons name="camera-plus-outline" size={32} color={COLORS.outline} />
            <Text className="text-xs mt-2 uppercase tracking-widest" style={{ color: COLORS.outline }}>
              AJOUTER PHOTOS ({images.length}/5)
            </Text>
          </TouchableOpacity>
          {images.length > 0 && (
            <ScrollView horizontal className="mt-3" contentContainerStyle={{ gap: 8 }}>
              {images.map((uri, i) => (
                <RNImage key={i} source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8 }} />
              ))}
            </ScrollView>
          )}
        </View>

        {/* Info */}
        <View className="flex-row gap-3 rounded-xl p-4" style={{ backgroundColor: COLORS.surfaceContainerLow }}>
          <MaterialCommunityIcons name="information-outline" size={20} color={COLORS.outline} />
          <Text className="flex-1 text-xs" style={{ color: COLORS.outline }}>
            Notre équipe de designers vous répond avec une proposition personnalisée sous 48h.
          </Text>
        </View>

        <Button
          label="Envoyer la demande"
          onPress={handleSubmit}
          loading={createQuote.isPending}
          size="lg"
        />
      </ScrollView>
    </SafeAreaView>
  );
}
