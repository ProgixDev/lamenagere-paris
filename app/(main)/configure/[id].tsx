import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, {
  FadeInDown,
  SlideInLeft,
  SlideInRight,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Icon from "../../../components/ui/Icon";
import RulerPicker from "../../../components/ui/RulerPicker";
import Button from "../../../components/ui/Button";
import PressableScale from "../../../components/ui/PressableScale";
import ProductConfigBlocks from "../../../components/product/ProductConfigBlocks";
import ConfigRecap from "../../../components/product/ConfigRecap";
import ShapePlan, { type PlanHighlight } from "../../../components/product/ShapePlan";
import { COLORS, PRODUCT_TYPES, PRICE_MODES } from "../../../lib/constants";
import { FONTS, TYPE, SHADOW, SPACE } from "../../../lib/typography";
import { formatPrice } from "../../../lib/utils";
import { computeConfiguredPrice, perSqmRate } from "../../../lib/pricing";
import { areaFormula, type AreaDimensions } from "../../../lib/area-formulas";
import {
  buildConfiguration,
  configSurchargeEuros,
  configValidation,
  blockApplies,
  dimensionsFromConfigState,
  ilotSurchargeCents,
  type ConfigState,
} from "../../../lib/config-blocks";
import {
  buildSteps,
  PRODUCT_COLOR_BLOCK_ID,
  runsOfShape,
  stepCopy,
  visibleFields,
  type Step,
} from "../../../lib/configure-steps";
import type { ConfigBlock, ConfigBlockOption, ProductColor } from "../../../lib/types";
import { useProduct } from "../../../features/products/hooks";
import { useCartStore } from "../../../features/cart/store";

export default function ConfigureScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: product, isLoading } = useProduct(id);
  const addItem = useCartStore((s) => s.addItem);

  const [stepIdx, setStepIdx] = useState(0);
  /** Which way the last move went, so the screen slides in from that side. */
  const [dir, setDir] = useState<1 | -1>(1);
  const [dimInputs, setDimInputs] = useState<Record<string, string>>({});
  const [qualityTier, setQualityTier] = useState<string | null>(null);
  const [configState, setConfigState] = useState<ConfigState>({});
  const [quantity, setQuantity] = useState(1);
  /** The product's own colourway, from "Médias & couleurs". */
  const [productColorKey, setProductColorKey] = useState<string | null>(null);
  /** The measurement being typed, lit up on the plan. */
  const [focus, setFocus] = useState<PlanHighlight>(null);

  const isPerSqm = product?.priceMode === PRICE_MODES.PER_SQM;
  const blocks = (product?.configBlocks ?? product?.category.configBlocks ?? []).filter(
    (b) => blockApplies(b, isPerSqm),
  );
  const byShape = isPerSqm && product?.areaFormula === "by_shape";
  const needsDims =
    !byShape && (product?.productType === PRODUCT_TYPES.CONFIGURABLE || isPerSqm);
  const qualityTiers = product?.qualityTiers ?? [];

  const steps = useMemo<Step[]>(
    () => (product ? buildSteps(product, blocks, { byShape, needsDims }) : []),
    [product, blocks, byShape, needsDims],
  );

  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  useEffect(() => {
    const target = steps.length ? (stepIdx + 1) / steps.length : 0;
    progress.value = withTiming(target, { duration: reduceMotion ? 0 : 320 });
  }, [stepIdx, steps.length, progress, reduceMotion]);

  if (isLoading || !product) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  const step = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;

  // ── Derived state ────────────────────────────────────────────────────────
  const shapeBlock = blocks.find((b) => b.type === "shape");
  const shapeKey = shapeBlock ? configState[shapeBlock.id]?.shapeKey : undefined;
  const runs = runsOfShape(shapeBlock, shapeKey);

  const formula = areaFormula(product.areaFormula);
  const entered: AreaDimensions = {};
  for (const field of formula.fields) {
    const value = parseFloat(dimInputs[field.key] ?? "");
    if (Number.isFinite(value)) entered[field.key] = value;
  }
  const dimsComplete = formula.fields.every((f) => (entered[f.key] ?? 0) > 0);
  const shapeDims = byShape ? dimensionsFromConfigState(blocks, configState) : undefined;
  const shapeDimsReady = !!shapeDims && (shapeDims.width ?? 0) > 0 && (shapeDims.height ?? 0) > 0;
  const dims = byShape
    ? shapeDimsReady
      ? shapeDims
      : undefined
    : needsDims && dimsComplete
      ? entered
      : undefined;

  const productColors = product?.colors ?? [];
  const pickedVariant = productColors.find((c) => c.key === productColorKey);

  // The chosen colourway travels as an ordinary configuration entry, so it
  // reaches the cart, the order and every recap without a parallel channel.
  const configuration = [
    ...buildConfiguration(blocks, configState),
    ...(pickedVariant
      ? [
          {
            blockId: PRODUCT_COLOR_BLOCK_ID,
            type: "colors" as const,
            label: "Coloris",
            colors: [{ key: pickedVariant.key, label: pickedVariant.name }],
          },
        ]
      : []),
  ];
  const surcharge = configSurchargeEuros(configuration);
  const base = computeConfiguredPrice(product, dims, qualityTier ?? undefined);
  const total = base != null ? base + surcharge : undefined;
  const liveRate = isPerSqm ? perSqmRate(product, qualityTier ?? undefined) : undefined;

  const ilotBlock = blocks.find((b) => b.type === "ilot");
  const ilotOn = ilotBlock
    ? !!ilotBlock.required || configState[ilotBlock.id]?.ilotIncluded === true
    : false;

  /** The option the customer has picked in a colour block, if any. */
  const pickedColor = (b: ConfigBlock) =>
    (b.options ?? []).find((o) => o.key === configState[b.id]?.colorKeys?.[0]);

  /**
   * Label of the measurement that multiplies the runs — "Hauteur mur" on a
   * kitchen, "Profondeur" on a sofa. The plan names it rather than assuming.
   */
  const heightLabel = blocks
    .filter((b) => b.type === "measurements")
    .flatMap((b) => b.fields ?? [])
    .find((f) => f.priceRole === "height")?.label;

  /** Measured values per role, so the plan can print the cotes. */
  const planValues: Partial<Record<"run1" | "run2" | "run3" | "height", number>> = {};
  for (const b of blocks) {
    if (b.type !== "measurements") continue;
    for (const f of b.fields ?? []) {
      const raw = configState[b.id]?.measurements?.[f.key];
      const v = raw != null && raw !== "" ? parseFloat(raw) : NaN;
      if (!Number.isFinite(v) || !f.priceRole) continue;
      planValues[f.priceRole as keyof typeof planValues] = v;
    }
  }

  // ── Per-step validation ──────────────────────────────────────────────────
  function stepError(): string | null {
    if (!step) return null;
    if (step.kind === "shape" && step.block.required && !shapeKey) {
      return "Choisissez une forme";
    }
    if (step.kind === "measures") {
      const shown = visibleFields(step.block, { byShape, runs });
      if (step.block.required) {
        const filled = shown.every((f) => {
          const raw = configState[step.block.id]?.measurements?.[f.key];
          return raw != null && raw !== "" && Number.isFinite(parseFloat(raw));
        });
        if (!filled) return "Complétez vos mesures";
      }
      if (byShape && !shapeDimsReady) return "Renseignez vos mesures pour voir le prix";
    }
    if (step.kind === "dims" && !dimsComplete) {
      return `Renseignez ${formula.fields.map((f) => f.label.toLowerCase()).join(", ")}`;
    }
    if (step.kind === "ilot") {
      if (!step.block.required && configState[step.block.id]?.ilotIncluded == null) {
        return "Indiquez si vous souhaitez un îlot";
      }
      if (ilotOn) {
        const v = configValidation([{ ...step.block, required: true }], configState);
        if (!v.ok) return "Renseignez les dimensions de l'îlot";
      }
    }
    if (step.kind === "tiers" && !qualityTier) return "Choisissez une gamme";
    if (step.kind === "productColor" && !productColorKey) return "Choisissez un coloris";
    if (step.kind === "colors") {
      const v = configValidation([step.block], configState);
      if (!v.ok) return v.hint ?? "Faites votre choix";
    }
    if (step.kind === "extras") {
      const v = configValidation(step.blocks, configState);
      if (!v.ok) return v.hint ?? "Complétez vos options";
    }
    return null;
  }
  const error = stepError();

  const go = async (delta: 1 | -1) => {
    if (delta === 1 && error) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    await Haptics.selectionAsync();
    setFocus(null);
    setDir(delta);
    setStepIdx((i) => Math.min(steps.length - 1, Math.max(0, i + delta)));
  };
  const back = () => {
    if (stepIdx === 0) router.back();
    else void go(-1);
  };
  const addToCart = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addItem(product, quantity, dims, qualityTier ?? undefined, {
      configuration,
      configSurcharge: surcharge,
    });
    router.replace("/(tabs)/cart");
  };

  const copy = step ? stepCopy(step) : { title: "", subtitle: "" };

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
        <View style={{ height: 4, borderRadius: 2, backgroundColor: COLORS.surfaceContainer, overflow: "hidden" }}>
          <Animated.View style={[{ height: 4, borderRadius: 2, backgroundColor: COLORS.primary }, barStyle]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <Animated.View
          key={stepIdx}
          entering={
            reduceMotion ? undefined : (dir === 1 ? SlideInRight : SlideInLeft).duration(260)
          }
        >
          <View style={{ paddingHorizontal: 16, marginBottom: 14 }}>
            <Text style={[TYPE.screenTitle]}>{copy.title}</Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: COLORS.outline, marginTop: 4 }}>
              {copy.subtitle}
            </Text>
          </View>

          {/* ── Forme ─────────────────────────────────────────────────── */}
          {step?.kind === "shape" && (
            <View style={{ paddingHorizontal: 16, gap: 12 }}>
              {(step.block.options ?? []).map((o, i) => {
                const active = shapeKey === o.key;
                const blockId = step.block.id;
                return (
                  <Animated.View key={o.key} entering={reduceMotion ? undefined : FadeInDown.delay(i * 60).springify()}>
                    <PressableScale
                      onPress={() => {
                        Haptics.selectionAsync();
                        setConfigState((s) => ({
                          ...s,
                          [blockId]: { ...s[blockId], shapeKey: o.key },
                        }));
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 14,
                        padding: 14,
                        borderRadius: 18,
                        backgroundColor: COLORS.surfaceContainerLowest,
                        borderWidth: active ? 2 : 1,
                        borderColor: active ? COLORS.primary : COLORS.outlineVariant,
                        ...SHADOW.card,
                      }}
                    >
                      <View style={{ width: 96 }}>
                        <ShapePlan shapeKey={o.key} height={78} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 17, fontFamily: FONTS.serif, color: active ? COLORS.primary : COLORS.onSurface }}>
                          {o.label}
                        </Text>
                        <Text style={{ fontSize: 12.5, fontFamily: "Inter_400Regular", color: COLORS.outline, marginTop: 2 }}>
                          {o.runs === 3 ? "Trois murs" : o.runs === 2 ? "Deux murs en angle" : "Un seul mur"}
                        </Text>
                      </View>
                      {active && <Icon name="check-circle" size={22} color={COLORS.primary} />}
                    </PressableScale>
                  </Animated.View>
                );
              })}
            </View>
          )}

          {/* ── Mesures ───────────────────────────────────────────────── */}
          {step?.kind === "measures" && (
            <View style={{ paddingHorizontal: 16, gap: 14 }}>
              <View style={{ backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 18, padding: 10, ...SHADOW.card }}>
                <ShapePlan
                  shapeKey={shapeKey}
                  highlight={focus}
                  values={planValues}
                  withIlot={ilotOn}
                  heightLabel={heightLabel}
                />
              </View>
              {visibleFields(step.block, { byShape, runs }).map((f, i) => {
                const blockId = step.block.id;
                return (
                  <Animated.View key={f.key} entering={reduceMotion ? undefined : FadeInDown.delay(i * 50).springify()}>
                    <RulerPicker
                      label={f.label}
                      value={configState[blockId]?.measurements?.[f.key] ?? ""}
                      min={f.min}
                      max={f.max}
                      unit={f.unit ?? "cm"}
                      onChange={(t) =>
                        setConfigState((s) => ({
                          ...s,
                          [blockId]: {
                            ...s[blockId],
                            measurements: { ...(s[blockId]?.measurements ?? {}), [f.key]: t },
                          },
                        }))
                      }
                      onActiveChange={(on) =>
                        setFocus(on ? ((f.priceRole as PlanHighlight) ?? null) : null)
                      }
                    />
                  </Animated.View>
                );
              })}
              {byShape && liveRate != null && (
                <Text style={{ fontSize: 12.5, fontFamily: "Inter_500Medium", color: COLORS.secondary }}>
                  {formatPrice(liveRate)}/m²
                  {shapeDimsReady
                    ? ` · ${formula.areaM2(shapeDims!).toFixed(2)} m² facturés`
                    : " · complétez vos mesures pour voir le prix"}
                </Text>
              )}
            </View>
          )}

          {/* ── Dimensions (formule statique) ─────────────────────────── */}
          {step?.kind === "dims" && (
            <View style={{ paddingHorizontal: 16, gap: 14 }}>
              {formula.fields.map((field, i) => (
                <Animated.View key={field.key} entering={reduceMotion ? undefined : FadeInDown.delay(i * 50).springify()}>
                  <RulerPicker
                    label={field.label}
                    value={dimInputs[field.key] ?? ""}
                    min={
                      field.axis === "vertical"
                        ? product.minDimensions?.height
                        : product.minDimensions?.width
                    }
                    max={
                      field.axis === "vertical"
                        ? product.maxDimensions?.height
                        : product.maxDimensions?.width
                    }
                    onChange={(t) => setDimInputs((d) => ({ ...d, [field.key]: t }))}
                  />
                </Animated.View>
              ))}
              {isPerSqm && dimsComplete && (
                <Text style={{ fontSize: 12.5, fontFamily: "Inter_500Medium", color: COLORS.secondary }}>
                  Surface : {formula.areaM2(entered).toFixed(2)} m²
                  {liveRate != null ? ` · ${formatPrice(liveRate)}/m²` : ""}
                </Text>
              )}
            </View>
          )}

          {/* ── Îlot ──────────────────────────────────────────────────── */}
          {step?.kind === "ilot" && (
            <View style={{ paddingHorizontal: 16, gap: 14 }}>
              <View style={{ backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 18, padding: 10, ...SHADOW.card }}>
                <ShapePlan shapeKey={shapeKey} withIlot={ilotOn} highlight={ilotOn ? "ilot" : null} />
              </View>
              {!step.block.required && (
                <View style={{ alignItems: "center", paddingVertical: SPACE.sm }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "center",
                      gap: SPACE.md,
                      width: "100%",
                      maxWidth: 320,
                    }}
                  >
                    {[
                      { label: "Oui, avec îlot", value: true },
                      { label: "Non merci", value: false },
                    ].map((c) => {
                      const blockId = step.block.id;
                      const active = configState[blockId]?.ilotIncluded === c.value;
                      return (
                        <PressableScale
                          key={c.label}
                          accessibilityRole="button"
                          selected={active}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setConfigState((s) => ({
                              ...s,
                              [blockId]: { ...s[blockId], ilotIncluded: c.value },
                            }));
                          }}
                          style={{
                            flex: 1,
                            minHeight: 56,
                            paddingVertical: SPACE.lg,
                            paddingHorizontal: SPACE.md,
                            borderRadius: 16,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: active ? COLORS.primary : COLORS.surfaceContainerLowest,
                            borderWidth: active ? 2 : 1,
                            borderColor: active ? COLORS.primary : COLORS.outlineVariant,
                            ...SHADOW.card,
                          }}
                        >
                          <Text
                            numberOfLines={2}
                            style={{
                              fontSize: 14,
                              lineHeight: 18,
                              textAlign: "center",
                              fontFamily: "Inter_600SemiBold",
                              color: active ? COLORS.onPrimary : COLORS.onSurface,
                            }}
                          >
                            {c.label}
                          </Text>
                        </PressableScale>
                      );
                    })}
                  </View>
                </View>
              )}
              {ilotOn &&
                (step.block.fields ?? []).map((f, i) => {
                  const blockId = step.block.id;
                  return (
                    <Animated.View key={f.key} entering={reduceMotion ? undefined : FadeInDown.delay(i * 50).springify()}>
                      <RulerPicker
                        label={f.label}
                        value={configState[blockId]?.measurements?.[f.key] ?? ""}
                        min={f.min}
                        max={f.max}
                        unit={f.unit ?? "cm"}
                        onChange={(t) =>
                          setConfigState((s) => ({
                            ...s,
                            [blockId]: {
                              ...s[blockId],
                              measurements: { ...(s[blockId]?.measurements ?? {}), [f.key]: t },
                            },
                          }))
                        }
                      />
                    </Animated.View>
                  );
                })}
              {ilotOn && <IlotPrice block={step.block} state={configState} />}
            </View>
          )}

          {/* ── Gamme ─────────────────────────────────────────────────── */}
          {step?.kind === "tiers" && (
            <View style={{ paddingHorizontal: 16, gap: 12 }}>
              {qualityTiers.map((tier, i) => {
                const active = qualityTier === tier.key;
                return (
                  <Animated.View key={tier.key} entering={reduceMotion ? undefined : FadeInDown.delay(i * 60).springify()}>
                    <PressableScale
                      onPress={() => {
                        Haptics.selectionAsync();
                        setQualityTier(tier.key);
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingHorizontal: 18,
                        paddingVertical: 18,
                        borderRadius: 18,
                        backgroundColor: active ? COLORS.primary : COLORS.surfaceContainerLowest,
                        borderWidth: active ? 2 : 1,
                        borderColor: active ? COLORS.primary : COLORS.outlineVariant,
                        ...SHADOW.card,
                      }}
                    >
                      <Text style={{ fontSize: 17, fontFamily: FONTS.serif, color: active ? COLORS.onPrimary : COLORS.onSurface }}>
                        {tier.label}
                      </Text>
                      <Text style={{ fontSize: 15, fontFamily: "Manrope_700Bold", color: active ? COLORS.onPrimary : COLORS.primary }}>
                        {formatPrice(tier.pricePerSqm)}/m²
                      </Text>
                    </PressableScale>
                  </Animated.View>
                );
              })}
              {dims && qualityTier && total != null && (
                <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: COLORS.secondary, textAlign: "center", marginTop: 4 }}>
                  Votre configuration : {formatPrice(total)}
                </Text>
              )}
            </View>
          )}

          {/* ── Coloris du produit ────────────────────────────────────── */}
          {step?.kind === "productColor" && (
            <View style={{ gap: 14 }}>
              <View style={{ paddingHorizontal: 16 }}>
                <VariantShowcase variant={pickedVariant} />
              </View>
              <View
                style={{ paddingHorizontal: 16, flexDirection: "row", flexWrap: "wrap", gap: 12 }}
              >
                {productColors.map((c, i) => {
                  const active = productColorKey === c.key;
                  return (
                    <Animated.View
                      key={c.key}
                      entering={reduceMotion ? undefined : FadeInDown.delay(i * 50).springify()}
                    >
                      <PressableScale
                        onPress={() => {
                          Haptics.selectionAsync();
                          setProductColorKey(c.key);
                        }}
                        style={{ width: 78, alignItems: "center" }}
                      >
                        <View
                          style={{
                            width: 62,
                            height: 62,
                            borderRadius: 31,
                            overflow: "hidden",
                            backgroundColor: c.hex ?? COLORS.surfaceContainer,
                            borderWidth: active ? 3 : 1,
                            borderColor: active ? COLORS.primary : COLORS.outlineVariant,
                          }}
                        >
                          {c.images?.[0] ? (
                            <Image source={{ uri: c.images[0] }} style={{ width: "100%", height: "100%" }} />
                          ) : null}
                        </View>
                        <Text
                          numberOfLines={2}
                          style={{
                            fontSize: 11.5,
                            fontFamily: active ? "Inter_600SemiBold" : "Inter_500Medium",
                            color: active ? COLORS.primary : COLORS.onSurface,
                            marginTop: 6,
                            textAlign: "center",
                          }}
                        >
                          {c.name}
                        </Text>
                      </PressableScale>
                    </Animated.View>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Couleurs ──────────────────────────────────────────────── */}
          {step?.kind === "colors" && (
            <View style={{ gap: 14 }}>
              <View style={{ paddingHorizontal: 16 }}>
                <ColorShowcase option={pickedColor(step.block)} />
              </View>
              <ProductConfigBlocks blocks={[step.block]} value={configState} onChange={setConfigState} />
            </View>
          )}

          {/* ── Options ───────────────────────────────────────────────── */}
          {step?.kind === "extras" && (
            <ProductConfigBlocks blocks={step.blocks} value={configState} onChange={setConfigState} />
          )}

          {/* ── Récapitulatif ─────────────────────────────────────────── */}
          {step?.kind === "summary" && (
            <View style={{ paddingHorizontal: 16, gap: 12 }}>
              <View style={{ backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 18, padding: 16, ...SHADOW.card }}>
                <Text style={{ fontSize: 20, fontFamily: FONTS.serif, color: COLORS.onSurface }}>
                  {product.name}
                </Text>
                {qualityTier && (
                  <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: COLORS.outline, marginTop: 2 }}>
                    {qualityTiers.find((t) => t.key === qualityTier)?.label}
                  </Text>
                )}
                <ConfigRecap configuration={configuration} />
              </View>

              <View style={{ backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", ...SHADOW.card }}>
                <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: COLORS.onSurface }}>Quantité</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
                  <TouchableOpacity onPress={() => setQuantity((q) => Math.max(1, q - 1))} hitSlop={10}>
                    <Icon name="minus-circle-outline" size={26} color={quantity > 1 ? COLORS.primary : COLORS.outline} />
                  </TouchableOpacity>
                  <Text style={{ fontSize: 16, fontFamily: "Manrope_700Bold", color: COLORS.onSurface, minWidth: 20, textAlign: "center" }}>
                    {quantity}
                  </Text>
                  <TouchableOpacity onPress={() => setQuantity((q) => q + 1)} hitSlop={10}>
                    <Icon name="plus-circle-outline" size={26} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 18, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", ...SHADOW.card }}>
                <Text style={{ fontSize: 20, fontFamily: FONTS.serif, color: COLORS.onSurface }}>Total</Text>
                <Text style={[TYPE.priceLarge, { color: COLORS.primary }]}>
                  {total != null ? formatPrice(total * quantity) : "Sur mesure"}
                </Text>
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Footer */}
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24, borderTopWidth: 1, borderTopColor: `${COLORS.outlineVariant}80`, backgroundColor: "#fff" }}>
        {!isLast && total != null && (
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Text style={{ fontSize: 12.5, fontFamily: "Inter_500Medium", color: COLORS.outline }}>Total estimé</Text>
            <Text style={{ fontSize: 17, fontFamily: "Manrope_700Bold", color: COLORS.primary }}>
              {formatPrice(total)}
            </Text>
          </View>
        )}
        {error && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Icon name="information-outline" size={14} color={COLORS.outline} />
            <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: COLORS.outline }}>{error}</Text>
          </View>
        )}
        {isLast ? (
          <Button label="Ajouter au panier" onPress={addToCart} size="lg" />
        ) : (
          <Button label="Continuer" onPress={() => void go(1)} size="lg" disabled={!!error} />
        )}
      </View>
    </SafeAreaView>
  );
}

/** Live price of the island, mirroring what the server will charge for it. */
function IlotPrice({ block, state }: { block: ConfigBlock; state: ConfigState }) {
  const entered = (block.fields ?? [])
    .map((f) => {
      const raw = state[block.id]?.measurements?.[f.key];
      const v = raw != null && raw !== "" ? parseFloat(raw) : NaN;
      return Number.isFinite(v) ? { key: f.key, value: v } : null;
    })
    .filter((m): m is { key: string; value: number } => m != null);
  const cents = ilotSurchargeCents(block, entered);
  if (!cents) return null;
  return (
    <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: COLORS.secondary }}>
      Îlot : + {formatPrice(cents / 100)}
    </Text>
  );
}

/**
 * The element or accessory in the colour being picked, from the photo attached
 * to that option.
 *
 * This is deliberately not the product's own colourway: that one lives in
 * "Médias & couleurs", drives the product gallery, and is a different decision.
 */
function ColorShowcase({ option }: { option?: ConfigBlockOption }) {
  if (option?.image) {
    return (
      <Image
        source={{ uri: option.image }}
        style={{ width: "100%", height: 210, borderRadius: 18, backgroundColor: COLORS.surfaceContainer }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View
      style={{
        height: 210,
        borderRadius: 18,
        backgroundColor: option?.hex ?? COLORS.surfaceContainer,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {!option && (
        <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: COLORS.outline }}>
          Choisissez une couleur
        </Text>
      )}
    </View>
  );
}

/**
 * The product photographed in the chosen colourway. A variant usually carries
 * several shots, so they page horizontally rather than showing only the first.
 */
function VariantShowcase({ variant }: { variant?: ProductColor }) {
  const [page, setPage] = useState(0);
  const shots = variant?.images ?? [];
  const w = Dimensions.get("window").width - 32;

  if (!shots.length) {
    return (
      <View
        style={{
          height: 230,
          borderRadius: 18,
          backgroundColor: variant?.hex ?? COLORS.surfaceContainer,
          borderWidth: 1,
          borderColor: COLORS.outlineVariant,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {!variant && (
          <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: COLORS.outline }}>
            Choisissez un coloris
          </Text>
        )}
      </View>
    );
  }

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={32}
        onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / w))}
        style={{ borderRadius: 18 }}
      >
        {shots.map((uri) => (
          <Image
            key={uri}
            source={{ uri }}
            style={{ width: w, height: 230, backgroundColor: COLORS.surfaceContainer }}
            resizeMode="cover"
          />
        ))}
      </ScrollView>
      {shots.length > 1 && (
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10 }}>
          {shots.map((uri, i) => (
            <View
              key={uri}
              style={{
                width: i === page ? 18 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === page ? COLORS.primary : COLORS.outlineVariant,
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}
