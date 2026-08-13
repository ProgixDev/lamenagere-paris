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
import { FONTS, TYPE, SHADOW } from "../../../lib/typography";
import { formatPrice } from "../../../lib/utils";
import { computeConfiguredPrice, perSqmRate } from "../../../lib/pricing";
import {
  areaFormula,
  formatAreaDimensions,
  type AreaDimensions,
} from "../../../lib/area-formulas";
import {
  buildConfiguration,
  configSurchargeEuros,
  configValidation,
  dimensionsFromConfigState,
  summarizeConfiguration,
  type ConfigState,
} from "../../../lib/config-blocks";
import { useProduct } from "../../../features/products/hooks";
import { useCartStore } from "../../../features/cart/store";

type StepKind = "measures" | "options" | "summary";

/**
 * The order the customer is asked things in, fixed here on purpose.
 *
 * The back office decides *which* modules exist and what they contain, but not
 * the sequence: a manager reordering blocks in the editor must never be able to
 * ask for the gamme before the shape. Blocks of the same family keep the order
 * they were given (Array#sort is stable), so two colour blocks stay in the
 * admin's order relative to each other.
 */
const BLOCK_RANK: Record<string, number> = {
  shape: 0,
  ilot: 1,
  measurements: 2,
  colors: 3,
  opening_details: 4,
  accessories: 5,
  options: 6,
  photos: 7,
};
/** Families asked before the gamme, in the first step. */
const FIRST_STEP_TYPES = new Set(["shape", "ilot", "measurements"]);
const byRank = (a: { type: string }, b: { type: string }) =>
  (BLOCK_RANK[a.type] ?? 99) - (BLOCK_RANK[b.type] ?? 99);

export default function ConfigureScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: product, isLoading } = useProduct(id);
  const addItem = useCartStore((s) => s.addItem);

  const [stepIdx, setStepIdx] = useState(0);
  // Keyed by dimension: the product's area formula decides which are asked for.
  const [dimInputs, setDimInputs] = useState<Record<string, string>>({});
  const [qualityTier, setQualityTier] = useState<string | null>(null);
  const [configState, setConfigState] = useState<ConfigState>({});
  const [quantity, setQuantity] = useState(1);

  const blocks = product?.configBlocks ?? product?.category.configBlocks ?? [];
  const isPerSqm = product?.priceMode === PRICE_MODES.PER_SQM;
  // Shape-driven pricing: the shape decides how many pans are billed, so it is
  // asked for alongside the measurements it scales — not after them.
  const byShape = isPerSqm && product?.areaFormula === "by_shape";
  const measurementBlocks = useMemo(
    () => blocks.filter((b) => FIRST_STEP_TYPES.has(b.type)).sort(byRank),
    [blocks],
  );
  const optionBlocks = useMemo(
    () => blocks.filter((b) => !FIRST_STEP_TYPES.has(b.type)).sort(byRank),
    [blocks],
  );

  // by_shape products take their dimensions from the blocks above, so they show
  // no separate largeur/hauteur inputs — that was the double entry.
  const needsDims =
    !byShape && (product?.productType === PRODUCT_TYPES.CONFIGURABLE || isPerSqm);
  const qualityTiers = product?.qualityTiers ?? [];
  const hasTiers = qualityTiers.length > 0;

  const steps = useMemo<StepKind[]>(() => {
    const s: StepKind[] = [];
    if (needsDims || measurementBlocks.length) s.push("measures");
    if (optionBlocks.length) s.push("options");
    s.push("summary");
    return s;
  }, [needsDims, measurementBlocks.length, optionBlocks.length]);

  if (isLoading || !product) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  // Non per-m² configurable products keep the historical largeur × hauteur,
  // since areaFormula() falls back to it when no formula is set.
  const formula = areaFormula(product.areaFormula);
  const entered: AreaDimensions = {};
  for (const field of formula.fields) {
    const value = parseFloat(dimInputs[field.key] ?? "");
    if (Number.isFinite(value)) entered[field.key] = value;
  }
  const dimsComplete = formula.fields.every((f) => (entered[f.key] ?? 0) > 0);
  const shapeDims = byShape ? dimensionsFromConfigState(blocks, configState) : undefined;
  const shapeDimsReady =
    !!shapeDims && (shapeDims.width ?? 0) > 0 && (shapeDims.height ?? 0) > 0;
  const dims = byShape
    ? (shapeDimsReady ? shapeDims : undefined)
    : needsDims && dimsComplete
      ? entered
      : undefined;
  const configuration = buildConfiguration(blocks, configState);
  const surcharge = configSurchargeEuros(configuration);
  const base = computeConfiguredPrice(product, dims, qualityTier ?? undefined);
  const total = base != null ? base + surcharge : undefined;
  const liveRate = isPerSqm ? perSqmRate(product, qualityTier ?? undefined) : undefined;

  const step = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;

  // Per-step validation gate.
  function stepError(): string | null {
    if (step === "measures") {
      const v = configValidation(measurementBlocks, configState);
      if (!v.ok) return v.hint ?? "Complétez les mesures";
      if (byShape && !dims) return "Choisissez la forme et renseignez vos mesures";
      if (needsDims && !dims)
        return `Renseignez ${formula.fields.map((f) => f.label.toLowerCase()).join(", ")}`;
      if (hasTiers && !qualityTier) return "Choisissez une gamme";
    }
    if (step === "options") {
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
    addItem(product, quantity, dims, qualityTier ?? undefined, {
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
              <StepTitle title="Votre configuration" subtitle="Forme, dimensions puis gamme." />
              <ProductConfigBlocks blocks={measurementBlocks} value={configState} onChange={setConfigState} />
              {needsDims && (
                <View style={{ paddingHorizontal: 16 }}>
                  <View style={{ backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 16, ...SHADOW.card }}>
                    {/* One input per dimension the product's formula bills. */}
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                      {formula.fields.map((field) => (
                        <View key={field.key} style={{ flexGrow: 1, flexBasis: "45%" }}>
                          <Input
                            label={field.label.toUpperCase()}
                            value={dimInputs[field.key] ?? ""}
                            onChangeText={(t) =>
                              setDimInputs((d) => ({ ...d, [field.key]: t }))
                            }
                            keyboardType="numeric"
                            suffix="cm"
                          />
                        </View>
                      ))}
                    </View>
                    {isPerSqm && liveRate != null && (
                      <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: COLORS.secondary, marginTop: 8 }}>
                        {formatPrice(liveRate)}/m²
                        {formula.key !== "width_height" ? ` · ${formula.expression}` : ""}
                        {product.minDimensions && product.maxDimensions
                          ? ` · de ${product.minDimensions.width} à ${product.maxDimensions.width} cm`
                          : ""}
                      </Text>
                    )}
                    {isPerSqm && dimsComplete && (
                      <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: COLORS.onSurfaceVariant, marginTop: 6 }}>
                        Surface : {formula.areaM2(entered).toFixed(2)} m²
                      </Text>
                    )}
                  </View>
                </View>
              )}
              {hasTiers && (
                <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
                  <Text style={{ fontSize: 18, fontFamily: FONTS.serif, color: COLORS.onSurface, marginBottom: 12 }}>
                    Gamme
                  </Text>
                  <View style={{ gap: 8 }}>
                    {qualityTiers.map((tier) => {
                      const active = qualityTier === tier.key;
                      return (
                        <TouchableOpacity
                          key={tier.key}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setQualityTier(tier.key);
                          }}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            paddingHorizontal: 16,
                            paddingVertical: 14,
                            borderRadius: 14,
                            backgroundColor: active ? COLORS.primary : COLORS.surfaceContainerLowest,
                            borderWidth: 1,
                            borderColor: active ? COLORS.primary : COLORS.outlineVariant,
                            ...SHADOW.card,
                          }}
                        >
                          <Text style={{ fontSize: 15, fontFamily: active ? "Inter_600SemiBold" : "Inter_500Medium", color: active ? COLORS.onPrimary : COLORS.onSurface }}>
                            {tier.label}
                          </Text>
                          <Text style={{ fontSize: 14, fontFamily: "Manrope_700Bold", color: active ? COLORS.onPrimary : COLORS.primary }}>
                            {formatPrice(tier.pricePerSqm)}/m²
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            {byShape && liveRate != null && (
              <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
                <View style={{ backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 16, ...SHADOW.card }}>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: COLORS.secondary }}>
                    {formatPrice(liveRate)}/m² · {formula.expression}
                  </Text>
                  {shapeDimsReady ? (
                    <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: COLORS.onSurfaceVariant, marginTop: 6 }}>
                      Pans facturés : {shapeDims!.width} cm · Hauteur : {shapeDims!.height} cm ·
                      Surface : {formula.areaM2(shapeDims!).toFixed(2)} m²
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.outline, marginTop: 6 }}>
                      Choisissez la forme et renseignez vos mesures pour voir le prix.
                    </Text>
                  )}
                </View>
              </View>
            )}
            </View>
          )}

          {step === "options" && (
            <View style={{ paddingTop: 6 }}>
              <StepTitle title="Vos options" subtitle="Personnalisez votre produit." />
              <ProductConfigBlocks blocks={optionBlocks} value={configState} onChange={setConfigState} />
            </View>
          )}

          {step === "summary" && (
            <View style={{ paddingTop: 6 }}>
              <StepTitle title="Récapitulatif" subtitle="Vérifiez votre configuration avant de l'ajouter au panier." />
              <View style={{ paddingHorizontal: 16, gap: 12 }}>
                <View style={{ backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 16, ...SHADOW.card }}>
                  <Text style={{ fontSize: 20, fontFamily: FONTS.serif, color: COLORS.onSurface, marginBottom: 10 }}>
                    {product.name}
                  </Text>
                  {qualityTier && (
                    <SummaryRow
                      label="Gamme"
                      value={qualityTiers.find((t) => t.key === qualityTier)?.label ?? qualityTier}
                    />
                  )}
                  {dims && (
              <SummaryRow label="Dimensions" value={formatAreaDimensions(formula.key, dims)} />
            )}
                  {configuration.length > 0 && <SummaryRow label="Configuration" value={summarizeConfiguration(configuration)} />}
                  <SummaryRow label="Quantité" value={String(quantity)} />
                </View>

                {/* Quantity stepper */}
                <View style={{ backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", ...SHADOW.card }}>
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

                <View style={{ backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", ...SHADOW.card }}>
                  <Text style={{ fontSize: 20, fontFamily: FONTS.serif, color: COLORS.onSurface }}>Total</Text>
                  <Text style={[TYPE.priceLarge, { color: COLORS.primary }]}>
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
    <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
      <Text style={[TYPE.screenTitle]}>{title}</Text>
      <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: COLORS.outline, marginTop: 4 }}>{subtitle}</Text>
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
