import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Icon from "../../../components/ui/Icon";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";
import ProductConfigBlocks from "../../../components/product/ProductConfigBlocks";
import { COLORS, PRODUCT_TYPES, PRICE_MODES } from "../../../lib/constants";
import { formatPrice } from "../../../lib/utils";
import { computeConfiguredPrice } from "../../../lib/pricing";
import { openingTypeLabel, diagramForTypes } from "../../../lib/opening-types";
import {
  buildConfiguration,
  configSurchargeEuros,
  configValidation,
  summarizeConfiguration,
  type ConfigState,
} from "../../../lib/config-blocks";
import { useProduct } from "../../../features/products/hooks";
import { useCartStore } from "../../../features/cart/store";

type StepKind = "measures" | "options" | "summary";

export default function ConfigureScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: product, isLoading } = useProduct(id);
  const addItem = useCartStore((s) => s.addItem);

  const [stepIdx, setStepIdx] = useState(0);
  const [customWidth, setCustomWidth] = useState("");
  const [customHeight, setCustomHeight] = useState("");
  const [openingType, setOpeningType] = useState<string | null>(null);
  const [configState, setConfigState] = useState<ConfigState>({});
  const [quantity, setQuantity] = useState(1);

  const blocks = product?.configBlocks ?? product?.category.configBlocks ?? [];
  const measurementBlocks = useMemo(() => blocks.filter((b) => b.type === "measurements"), [blocks]);
  const optionBlocks = useMemo(() => blocks.filter((b) => b.type !== "measurements"), [blocks]);

  const isPerSqm = product?.priceMode === PRICE_MODES.PER_SQM;
  const needsDims = product?.productType === PRODUCT_TYPES.CONFIGURABLE || isPerSqm;
  const openingTypes = product?.openingTypes ?? [];
  const hasOpening = openingTypes.length > 0;

  const steps = useMemo<StepKind[]>(() => {
    const s: StepKind[] = [];
    if (needsDims || measurementBlocks.length) s.push("measures");
    if (hasOpening || optionBlocks.length) s.push("options");
    s.push("summary");
    return s;
  }, [needsDims, hasOpening, measurementBlocks.length, optionBlocks.length]);

  if (isLoading || !product) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  const dims =
    needsDims && customWidth && customHeight
      ? { width: parseFloat(customWidth), height: parseFloat(customHeight) }
      : undefined;
  const configuration = buildConfiguration(blocks, configState);
  const surcharge = configSurchargeEuros(configuration);
  const base = computeConfiguredPrice(product, dims, openingType ?? undefined);
  const total = base != null ? base + surcharge : undefined;

  const step = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;

  // Per-step validation gate.
  function stepError(): string | null {
    if (step === "measures") {
      if (needsDims && !dims) return "Renseignez la largeur et la hauteur";
      const v = configValidation(measurementBlocks, configState);
      if (!v.ok) return v.hint ?? "Complétez les mesures";
    }
    if (step === "options") {
      if (hasOpening && !openingType) return "Choisissez un type d'ouverture";
      const v = configValidation(optionBlocks, configState);
      if (!v.ok) return v.hint ?? "Complétez les options";
    }
    return null;
  }
  const error = stepError();

  const next = async () => {
    if (error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    await Haptics.selectionAsync();
    setStepIdx((i) => Math.min(steps.length - 1, i + 1));
  };
  const back = () => {
    if (stepIdx === 0) router.back();
    else setStepIdx((i) => i - 1);
  };
  const addToCart = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addItem(product, quantity, dims, openingType ?? undefined, {
      configuration,
      configSurcharge: surcharge,
    });
    router.replace("/(tabs)/cart");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      {/* Header + progress */}
      <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
          <TouchableOpacity onPress={back} hitSlop={10} style={{ marginRight: 12 }}>
            <Icon name="chevron-left" size={26} color={COLORS.onSurface} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontSize: 16, fontFamily: "Manrope_700Bold", color: COLORS.onSurface }}>
              {product.name}
            </Text>
            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.outline }}>
              Étape {stepIdx + 1} sur {steps.length}
            </Text>
          </View>
        </View>
        {/* progress bar */}
        <View style={{ flexDirection: "row", gap: 6 }}>
          {steps.map((_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: i <= stepIdx ? COLORS.primary : COLORS.surfaceContainer,
              }}
            />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <Animated.View key={step} entering={FadeIn.duration(220)}>
          {step === "measures" && (
            <View style={{ paddingTop: 6 }}>
              <StepTitle title="Vos mesures" subtitle="Indiquez les dimensions souhaitées." />
              {needsDims && (
                <View style={{ paddingHorizontal: 16 }}>
                  <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 14 }}>
                    <View style={{ flexDirection: "row", gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Input label="LARGEUR" value={customWidth} onChangeText={setCustomWidth} keyboardType="numeric" suffix="cm" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Input label="HAUTEUR" value={customHeight} onChangeText={setCustomHeight} keyboardType="numeric" suffix="cm" />
                      </View>
                    </View>
                    {isPerSqm && product.pricePerSqm != null && (
                      <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: COLORS.secondary, marginTop: 8 }}>
                        {formatPrice(product.pricePerSqm)}/m²
                        {product.minDimensions && product.maxDimensions
                          ? ` · de ${product.minDimensions.width}×${product.minDimensions.height} à ${product.maxDimensions.width}×${product.maxDimensions.height} cm`
                          : ""}
                      </Text>
                    )}
                  </View>
                </View>
              )}
              <ProductConfigBlocks blocks={measurementBlocks} value={configState} onChange={setConfigState} />
            </View>
          )}

          {step === "options" && (
            <View style={{ paddingTop: 6 }}>
              <StepTitle title="Vos options" subtitle="Personnalisez votre produit." />
              {hasOpening && (
                <View style={{ paddingHorizontal: 16, marginTop: 4 }}>
                  <Text style={{ fontSize: 14, fontFamily: "Manrope_700Bold", color: COLORS.onSurface, marginBottom: 10 }}>
                    Type d&apos;ouverture
                  </Text>
                  <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 14 }}>
                    {(() => {
                      const diagram = diagramForTypes(openingTypes.map((o) => o.type));
                      return diagram ? (
                        <Animated.Image
                          source={diagram}
                          style={{ width: "100%", height: 140, borderRadius: 10, marginBottom: 12, backgroundColor: COLORS.surfaceContainer }}
                          resizeMode="contain"
                        />
                      ) : null;
                    })()}
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
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
                              {opt.surcharge > 0 ? ` +${formatPrice(opt.surcharge)}` : ""}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>
              )}
              <ProductConfigBlocks blocks={optionBlocks} value={configState} onChange={setConfigState} />
            </View>
          )}

          {step === "summary" && (
            <View style={{ paddingTop: 6 }}>
              <StepTitle title="Récapitulatif" subtitle="Vérifiez votre configuration avant de l'ajouter au panier." />
              <View style={{ paddingHorizontal: 16, gap: 12 }}>
                <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 16 }}>
                  <Text style={{ fontSize: 15, fontFamily: "Manrope_700Bold", color: COLORS.onSurface, marginBottom: 8 }}>
                    {product.name}
                  </Text>
                  {dims && <SummaryRow label="Dimensions" value={`${dims.width} × ${dims.height} cm`} />}
                  {openingType && <SummaryRow label="Ouverture" value={openingTypeLabel(openingType)} />}
                  {configuration.length > 0 && <SummaryRow label="Configuration" value={summarizeConfiguration(configuration)} />}
                  <SummaryRow label="Quantité" value={String(quantity)} />
                </View>

                {/* Quantity stepper */}
                <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: COLORS.onSurface }}>Quantité</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
                    <TouchableOpacity onPress={() => setQuantity((q) => Math.max(1, q - 1))} hitSlop={8}>
                      <Icon name="minus-circle-outline" size={26} color={quantity > 1 ? COLORS.primary : COLORS.outline} />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 16, fontFamily: "Manrope_700Bold", color: COLORS.onSurface, minWidth: 20, textAlign: "center" }}>{quantity}</Text>
                    <TouchableOpacity onPress={() => setQuantity((q) => q + 1)} hitSlop={8}>
                      <Icon name="plus-circle-outline" size={26} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ backgroundColor: COLORS.surfaceContainerLow, borderRadius: 12, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: COLORS.onSurface }}>Total</Text>
                  <Text style={{ fontSize: 22, fontFamily: "Manrope_800ExtraBold", color: COLORS.secondary }}>
                    {total != null ? formatPrice(total * quantity) : "Sur mesure"}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Footer CTA */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, borderTopWidth: 1, borderTopColor: `${COLORS.outlineVariant}80`, backgroundColor: "#fff" }}>
        {error && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Icon name="information-outline" size={14} color={COLORS.outline} />
            <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: COLORS.outline }}>{error}</Text>
          </View>
        )}
        {isLast ? (
          <Button label="Ajouter au panier" onPress={addToCart} size="lg" />
        ) : (
          <Button label="Continuer" onPress={next} size="lg" disabled={!!error} />
        )}
      </View>
    </SafeAreaView>
  );
}

function StepTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
      <Text style={{ fontSize: 20, fontFamily: "Manrope_800ExtraBold", color: COLORS.onSurface }}>{title}</Text>
      <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: COLORS.outline, marginTop: 2 }}>{subtitle}</Text>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, gap: 12 }}>
      <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: COLORS.outline }}>{label}</Text>
      <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: COLORS.onSurface, flexShrink: 1, textAlign: "right" }}>{value}</Text>
    </View>
  );
}
