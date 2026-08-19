import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Image, Modal, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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
import { IndicativeChip, IndicativeSheet } from "../../../components/product/IndicativeNotice";
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
  FIXED_HEIGHTS_CM,
  hiddenHeight,
  PRODUCT_COLOR_BLOCK_ID,
  runsOfShape,
  stepCopy,
  visibleFields,
  type Step,
} from "../../../lib/configure-steps";
import Kitchen3D, { ZOOM_STEP, type Kitchen3DHandle } from "../../../components/product/Kitchen3D";
import { buildScene } from "../../../lib/kitchen3d/scene";
import { kitchenConfigFrom } from "../../../lib/kitchen3d/derive";
import {
  addModule,
  applyEdits,
  editsOfScene,
  fitsOnRun,
  ILOT_KEY,
  isFreeModule,
  moveIlot,
  moveModuleFree,
  moveRun,
  removeModule,
  reseatModule,
  rotateModule,
  rotateRun,
  runIndexOfKey,
} from "../../../lib/kitchen3d/edit";
import { MODULES, moduleById } from "../../../lib/kitchen3d/catalog";
import { layoutEntry } from "../../../lib/kitchen3d/selection";
import type { SceneEdits } from "../../../lib/kitchen3d/edit";
import type { KitchenScene, Wall } from "../../../lib/kitchen3d/types";

/** What each run is called on screen, once it no longer has to be on its wall. */
const RUN_LABEL: Partial<Record<Wall, string>> = {
  back: "Mur du fond",
  left: "Mur de gauche",
  right: "Mur de droite",
  front: "Mur avant",
};
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
  const sceneRef = useRef<Kitchen3DHandle>(null);
  /**
   * Read here and applied by hand inside the studio.
   *
   * A Modal renders into its own native root, so the SafeAreaProvider wrapping
   * the app does not reach inside it — a SafeAreaView in there resolves every
   * inset to zero and the header sits under the notch. Taking the values from
   * the screen, which is inside the provider, sidesteps that entirely.
   */
  const insets = useSafeAreaInsets();
  /** Whether a drag moves a cabinet or orbits the camera. */
  const [moveMode, setMoveMode] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  /**
   * The customer's own changes to the proposed implantation, kept against the
   * answers they were made for. Resize the room and the arrangement they were
   * made for no longer exists, so the edits are dropped and the kitchen is
   * proposed again rather than half-migrated onto a different space.
   */
  const [sceneEdits, setSceneEdits] = useState<(SceneEdits & { signature: string }) | null>(
    null,
  );
  /**
   * The room the kitchen stands in, which no config block asks for.
   *
   * The wall measurements say how much cabinetry there is, not how big the
   * space is — the same kitchen fits a 3 × 2 galley or two walls of a 4 × 5
   * room. Null means "as small as the runs allow", which is the honest default
   * when nobody has said otherwise.
   */
  const [roomCm, setRoomCm] = useState<{ length: number | null; width: number | null }>({
    length: null,
    width: null,
  });
  /** The full-screen 3D studio, which has room for controls the step does not. */
  const [studioOpen, setStudioOpen] = useState(false);
  /**
   * The "this is not your final kitchen" sheet.
   *
   * Two separate flags because they are two separate Modals: one belongs to the
   * screen, the other has to be rendered *inside* the studio's Modal to appear
   * above it. A single sheet at screen level would slide up behind the studio
   * and never be seen.
   */
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [studioNoticeOpen, setStudioNoticeOpen] = useState(false);
  /** Shown once per configuration; the chip on the canvas brings it back. */
  const noticeShown = useRef(false);
  /** Which corner the kitchen sits in: quarter turns clockwise, 0-3. */
  const [rotation, setRotation] = useState(0);
  /** Which way the island faces, independently of the kitchen. */
  const [ilotRotation, setIlotRotation] = useState(0);

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

  /**
   * Fills in the heights the customer is never shown.
   *
   * They are hidden from every screen, but the wall height is what a per-m²
   * kitchen is billed on and both belong in the recap — so they are written
   * into the same state an answer would have gone to, not special-cased
   * downstream. Existing values are left alone, so an order placed before this
   * keeps whatever it was quoted on.
   */
  useEffect(() => {
    const seed: ConfigState = {};
    for (const block of blocks) {
      // The îlot block too: its height is hidden and filled from the worktop,
      // and leaving it blank would bill the island at zero on a per-m² formula.
      if (block.type !== "measurements" && block.type !== "ilot") continue;
      for (const field of block.fields ?? []) {
        const kind = hiddenHeight(field, block.type);
        if (!kind) continue;
        const current = configState[block.id]?.measurements?.[field.key];
        if (current != null && current !== "") continue;
        seed[block.id] = {
          ...seed[block.id],
          measurements: {
            ...configState[block.id]?.measurements,
            ...seed[block.id]?.measurements,
            [field.key]: String(FIXED_HEIGHTS_CM[kind]),
          },
        };
      }
    }
    if (!Object.keys(seed).length) return;
    setConfigState((s) => {
      const next = { ...s };
      for (const [id, sel] of Object.entries(seed)) {
        next[id] = { ...next[id], measurements: { ...next[id]?.measurements, ...sel.measurements } };
      }
      return next;
    });
  }, [blocks, configState]);

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

  /**
   * The disclaimer meets the customer the first time the 3D appears, not on a
   * later step where it would have nothing to refer to.
   */
  useEffect(() => {
    if (step?.kind !== "scene" || noticeShown.current) return;
    noticeShown.current = true;
    setNoticeOpen(true);
  }, [step?.kind]);

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

  /**
   * The 3D scene, rebuilt from the answers already given rather than held in
   * state: the customer never designs from an empty room, and going back to
   * change a wall length or a colour is reflected the moment they return.
   *
   * Not memoised on purpose — this sits after the loading early-return, so a
   * hook here would break the rules of hooks. `buildScene` is a few dozen plain
   * objects, and `Kitchen3D` keys its injection on the serialised payload, so
   * an identical scene never reaches the WebView twice.
   */
  const sceneConfig = {
    ...kitchenConfigFrom(blocks, configState, {
      shapeKey,
      ilot: ilotOn,
      productColorHex: pickedVariant?.hex ?? undefined,
    }),
    roomLengthCm: roomCm.length ?? undefined,
    roomWidthCm: roomCm.width ?? undefined,
    rotationQuarters: rotation,
    ilotRotationQuarters: ilotRotation,
  };
  const proposed = buildScene(sceneConfig);
  // Only what changes the room invalidates an arrangement; a colour change
  // repaints the kitchen the customer built instead of throwing it away.
  const sceneSignature = JSON.stringify([
    sceneConfig.shapeKey,
    sceneConfig.run1Cm,
    sceneConfig.run2Cm,
    sceneConfig.run3Cm,
    sceneConfig.ilot,
    sceneConfig.ilotLengthCm,
    sceneConfig.ilotWidthCm,
    // Growing the room moves the free floor the island was placed in, so an
    // island the customer positioned by hand has to be re-proposed.
    sceneConfig.roomLengthCm,
    sceneConfig.roomWidthCm,
    // Turning the island is deliberately *not* here. It used to be, because a
    // turned island had to be re-placed against its new footprint — but that
    // threw away every side the customer had moved as well, for the sake of one
    // pivot. `applyEdits` re-clamps instead, so the arrangement survives.
  ]);
  const edits = sceneEdits?.signature === sceneSignature ? sceneEdits : null;
  const scene: KitchenScene = edits ? applyEdits(proposed, edits) : proposed;
  const showsScene = steps.some((s) => s.kind === "scene");

  const commitScene = (next: KitchenScene) =>
    setSceneEdits({ signature: sceneSignature, ...editsOfScene(next) });

  const selectedIsIlot = selectedKey === ILOT_KEY;
  /** Which run the selection is, when a whole run is what was tapped. */
  const selectedRunKeyIndex = selectedKey ? runIndexOfKey(selectedKey) : -1;
  const selectedRun = selectedRunKeyIndex >= 0 ? scene.runs[selectedRunKeyIndex] : null;
  const selectedRunIndex = scene.runs.findIndex((r) =>
    r.modules.some((m) => m.key === selectedKey),
  );
  const selectedModule =
    selectedRunIndex >= 0
      ? moduleById(
          scene.runs[selectedRunIndex].modules.find((m) => m.key === selectedKey)!.moduleId,
        )
      : undefined;
  /** True once the customer has dragged this cabinet off the row it came from. */
  const selectedIsFree = isFreeModule(scene, selectedKey);
  /** New modules join the run the selection is on, or the main wall. */
  const targetRun = selectedRunIndex >= 0 ? selectedRunIndex : 0;

  /**
   * The measurements that describe the space, editable straight from the 3D
   * step. They write back into the very fields the mesures step collected —
   * not into a copy — so the drawing, the recap and the m² price can never
   * disagree about how big the kitchen is.
   */
  const sceneDimFields = blocks
    .filter((b) => b.type === "measurements")
    .flatMap((b) =>
      visibleFields(b, { byShape, runs }).map((f) => {
        const raw = configState[b.id]?.measurements?.[f.key];
        const value = raw != null && raw !== "" ? parseFloat(raw) : undefined;
        return {
          blockId: b.id,
          key: f.key,
          label: f.label,
          min: f.min ?? 40,
          max: f.max ?? 800,
          // Wall lengths move in 10 cm; heights are a finer decision, and
          // 10 cm steps would step straight over a 95 cm worktop.
          step: (f.max ?? 800) >= 400 ? 10 : 5,
          value: Number.isFinite(value) ? (value as number) : undefined,
        };
      }),
    );

  /**
   * The room's own two dimensions, shown alongside the wall measurements.
   *
   * `min` is what the runs physically need, so the customer can grow the room
   * freely but can never shrink it below the kitchen standing in it. Until they
   * touch it the value tracks that minimum and is marked as automatic, which is
   * what tells them the tight room they are looking at is a default and not a
   * measurement of theirs.
   */
  const roomFields = (
    [
      { axis: "length" as const, label: "Longueur de la pièce", current: scene.room.widthM },
      { axis: "width" as const, label: "Largeur de la pièce", current: scene.room.depthM },
    ]
  ).map((f) => {
    const override = roomCm[f.axis];
    const min = Math.round(
      (f.axis === "length" ? scene.geometry.minRoom.widthM : scene.geometry.minRoom.depthM) * 100,
    );
    return { ...f, current: Math.round(f.current * 100), min, auto: override == null };
  });

  const turnKitchen = () => {
    void Haptics.selectionAsync();
    setSelectedKey(null);
    // The runs are described in the kitchen's own frame, so rearranged cabinets
    // survive a turn untouched. The island is placed in the room's frame and
    // the free floor has just moved under it, so that one is re-proposed.
    setSceneEdits((e) => (e ? { ...e, ilot: null } : e));
    setRotation((q) => (q + 1) % 4);
  };

  const nudgeRoom = (axis: "length" | "width", direction: 1 | -1) => {
    const field = roomFields.find((f) => f.axis === axis)!;
    const next = Math.min(1200, Math.max(field.min, field.current + 10 * direction));
    if (next === field.current) return;
    void Haptics.selectionAsync();
    setRoomCm((r) => ({ ...r, [axis]: next }));
  };

  const nudgeDim = (
    f: { blockId: string; key: string; min: number; max: number; step: number; value?: number },
    direction: 1 | -1,
  ) => {
    const current = f.value ?? f.min;
    const next = Math.min(f.max, Math.max(f.min, current + f.step * direction));
    if (next === current) return;
    void Haptics.selectionAsync();
    setConfigState((s) => ({
      ...s,
      [f.blockId]: {
        ...s[f.blockId],
        measurements: { ...s[f.blockId]?.measurements, [f.key]: String(next) },
      },
    }));
  };

  // The chosen colourway travels as an ordinary configuration entry, so it
  // reaches the cart, the order and every recap without a parallel channel.
  // The implantation rides along the same way.
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
    ...(showsScene ? [layoutEntry(scene)] : []),
  ];
  const surcharge = configSurchargeEuros(configuration);
  const base = computeConfiguredPrice(product, dims, qualityTier ?? undefined);
  const total = base != null ? base + surcharge : undefined;
  const liveRate = isPerSqm ? perSqmRate(product, qualityTier ?? undefined) : undefined;

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
                visibleFields(step.block, { byShape: false, runs: 0 }).map((f, i) => {
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

          {/* ── Vue 3D ────────────────────────────────────────────────── */}
          {step?.kind === "scene" && (
            <View style={{ paddingHorizontal: 16, gap: 12 }}>
              <View
                style={{
                  height: 240,
                  borderRadius: 18,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: COLORS.outlineVariant,
                  ...SHADOW.card,
                }}
              >
                {/* Unmounted while the studio is open. Two WebViews each
                    carrying their own three.js is a lot to keep alive on a
                    phone, and this one is behind a full-screen sheet anyway. */}
                {!studioOpen && <Kitchen3D scene={scene} />}
                <IndicativeChip
                  style={{ position: "absolute", left: 10, top: 10 }}
                  onPress={() => setNoticeOpen(true)}
                />
              </View>

              <Button
                label="Personnaliser en 3D"
                onPress={() => {
                  void Haptics.selectionAsync();
                  setStudioOpen(true);
                }}
                size="lg"
              />

              <View
                style={{
                  backgroundColor: COLORS.surfaceContainerLowest,
                  borderRadius: 18,
                  padding: 16,
                  ...SHADOW.card,
                }}
              >
                <Text style={{ fontSize: 15, fontFamily: FONTS.serif, color: COLORS.onSurface }}>
                  {scene.runs.reduce((n, r) => n + r.modules.length, 0)} éléments implantés
                </Text>
                <Text
                  style={{
                    fontSize: 12.5,
                    fontFamily: "Inter_400Regular",
                    color: COLORS.outline,
                    marginTop: 4,
                    lineHeight: 18,
                  }}
                >
                  Pièce {scene.room.widthM.toFixed(2).replace(".", ",")} ×{" "}
                  {scene.room.depthM.toFixed(2).replace(".", ",")} m. Ouvrez le studio pour
                  changer la taille de la pièce et déplacer les meubles.
                </Text>
              </View>
            </View>
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

      {/* ── Studio 3D ─────────────────────────────────────────────────────
          A sheet rather than a route: every bit of state the studio needs —
          the scene, the edits, the room size — already lives in this screen,
          and pushing a route would mean marshalling all of it through a store
          for no gain the customer can see. */}
      <Modal
        visible={studioOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setStudioOpen(false)}
        statusBarTranslucent={false}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: COLORS.background,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 10,
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontFamily: FONTS.serif, color: COLORS.onSurface }}>
                Studio 3D
              </Text>
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: COLORS.outline }}>
                {scene.runs.reduce((n, r) => n + r.modules.length, 0)} éléments ·{" "}
                {(scene.room.widthM * scene.room.depthM).toFixed(1).replace(".", ",")} m²
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setStudioOpen(false);
                setMoveMode(false);
                setSelectedKey(null);
              }}
              hitSlop={10}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 9,
                borderRadius: 999,
                backgroundColor: COLORS.primary,
              }}
            >
              <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: COLORS.onPrimary }}>
                Terminé
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1, borderWidth: moveMode ? 2 : 0, borderColor: COLORS.primary }}>
            {studioOpen && (
              <Kitchen3D
                ref={sceneRef}
                scene={scene}
                editable={moveMode}
                selectedKey={selectedKey}
                onSelect={setSelectedKey}
                onMoveModule={(key, x, z) => commitScene(moveModuleFree(scene, key, x, z))}
                onMoveIlot={(x, z) => commitScene(moveIlot(scene, x, z))}
                onMoveRun={(runIndex, x, z) => commitScene(moveRun(scene, runIndex, x, z))}
              />
            )}

            <TouchableOpacity
              onPress={turnKitchen}
              accessibilityLabel="Pivoter la cuisine d'un quart de tour"
              style={{
                position: "absolute",
                left: 12,
                top: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 7,
                paddingLeft: 11,
                paddingRight: 14,
                height: 40,
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.92)",
                borderWidth: 1,
                borderColor: COLORS.outlineVariant,
              }}
            >
              <Icon name="rotate-right" size={18} color={COLORS.onSurface} />
              <Text style={{ fontSize: 12.5, fontFamily: "Inter_600SemiBold", color: COLORS.onSurface }}>
                Pivoter
              </Text>
            </TouchableOpacity>

            {/* Top-right is the only free corner: Pivoter holds top-left, the
                room size bottom-left, the zoom bottom-right. */}
            <IndicativeChip
              style={{ position: "absolute", right: 12, top: 12 }}
              onPress={() => setStudioNoticeOpen(true)}
            />

            {/* Room size, opposite the zoom pill. */}
            <View
              style={{
                position: "absolute",
                left: 12,
                bottom: 12,
                borderRadius: 16,
                overflow: "hidden",
                backgroundColor: "rgba(255,255,255,0.92)",
                borderWidth: 1,
                borderColor: COLORS.outlineVariant,
              }}
            >
              {roomFields.map((f, i) => (
                <View
                  key={f.axis}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingLeft: 10,
                    paddingRight: 4,
                    height: 42,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: COLORS.outlineVariant,
                  }}
                >
                  <Text style={{ width: 26, fontSize: 11, fontFamily: "Inter_700Bold", color: COLORS.outline }}>
                    {f.axis === "length" ? "LON" : "LAR"}
                  </Text>
                  <TouchableOpacity
                    onPress={() => nudgeRoom(f.axis, -1)}
                    disabled={f.current <= f.min}
                    accessibilityLabel={`Réduire la ${f.label.toLowerCase()}`}
                    hitSlop={6}
                    style={{ paddingHorizontal: 7 }}
                  >
                    <Icon name="minus" size={17} color={f.current > f.min ? COLORS.onSurface : COLORS.outlineVariant} />
                  </TouchableOpacity>
                  <Text
                    style={{
                      minWidth: 48,
                      textAlign: "center",
                      fontSize: 13,
                      fontFamily: "Manrope_700Bold",
                      color: f.auto ? COLORS.outline : COLORS.onSurface,
                    }}
                  >
                    {f.current}
                  </Text>
                  <TouchableOpacity
                    onPress={() => nudgeRoom(f.axis, 1)}
                    accessibilityLabel={`Agrandir la ${f.label.toLowerCase()}`}
                    hitSlop={6}
                    style={{ paddingHorizontal: 7 }}
                  >
                    <Icon name="plus" size={17} color={COLORS.onSurface} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <View
              style={{
                position: "absolute",
                right: 12,
                bottom: 12,
                borderRadius: 999,
                overflow: "hidden",
                backgroundColor: "rgba(255,255,255,0.92)",
                borderWidth: 1,
                borderColor: COLORS.outlineVariant,
              }}
            >
              {([
                { key: "in", icon: "plus", factor: ZOOM_STEP.in, label: "Zoom avant" },
                { key: "out", icon: "minus", factor: ZOOM_STEP.out, label: "Zoom arrière" },
              ] as const).map((z, i) => (
                <TouchableOpacity
                  key={z.key}
                  onPress={() => {
                    Haptics.selectionAsync();
                    sceneRef.current?.zoom(z.factor);
                  }}
                  accessibilityLabel={z.label}
                  hitSlop={4}
                  style={{
                    width: 42,
                    height: 42,
                    alignItems: "center",
                    justifyContent: "center",
                    borderTopWidth: i === 1 ? 1 : 0,
                    borderTopColor: COLORS.outlineVariant,
                  }}
                >
                  <Icon name={z.icon} size={20} color={COLORS.onSurface} />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Controls live under the canvas so nothing covers the kitchen. */}
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, gap: 10 }}>
            <PressableScale
              onPress={() => {
                Haptics.selectionAsync();
                setMoveMode((v) => !v);
                setSelectedKey(null);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                paddingVertical: 12,
                borderRadius: 999,
                backgroundColor: moveMode ? COLORS.primary : COLORS.surfaceContainer,
              }}
            >
              <Icon
                name={moveMode ? "check" : "cursor-move"}
                size={18}
                color={moveMode ? COLORS.onPrimary : COLORS.onSurfaceVariant}
              />
              <Text
                style={{
                  fontSize: 13.5,
                  fontFamily: "Inter_600SemiBold",
                  color: moveMode ? COLORS.onPrimary : COLORS.onSurfaceVariant,
                }}
              >
                {moveMode ? "Terminer le déplacement" : "Déplacer les éléments"}
              </Text>
            </PressableScale>

            {moveMode ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontFamily: FONTS.serif, color: COLORS.onSurface }}>
                      {selectedIsIlot
                        ? "Îlot central"
                        : selectedRun
                          ? `${RUN_LABEL[selectedRun.wall] ?? "Mur"} · ${Math.round(selectedRun.lengthM * 100)} cm`
                          : selectedModule
                            ? selectedModule.label
                            : "Touchez un côté de la cuisine"}
                    </Text>
                    <Text
                      style={{
                        fontSize: 11.5,
                        fontFamily: "Inter_400Regular",
                        color: COLORS.outline,
                        marginTop: 1,
                      }}
                    >
                      {selectedIsIlot
                        ? "Glissez-le sur le sol, ou pivotez-le d'un quart de tour."
                        : selectedRun
                          ? selectedRun.overlaps
                            ? "En rouge : ce côté en chevauche un autre. Déplacez-le pour libérer la place."
                            : "Glissez-le où vous voulez, ou pivotez-le. Touchez un meuble pour le déplacer seul."
                          : selectedModule
                            ? selectedIsFree
                              ? `${selectedModule.widthMm} mm, posé librement — glissez-le n'importe où, ou contre un côté pour l'y remettre.`
                              : `${selectedModule.widthMm} mm — glissez-le n'importe où dans la pièce, ou le long de son côté pour échanger sa place.`
                            : "Il se déplace d'un bloc. Touchez-le à nouveau pour prendre un seul meuble."}
                    </Text>
                  </View>
                  {selectedIsIlot ? (
                    <TouchableOpacity
                      onPress={() => {
                        void Haptics.selectionAsync();
                        setIlotRotation((q) => (q + 1) % 4);
                      }}
                      hitSlop={8}
                      style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                    >
                      <Icon name="rotate-right" size={20} color={COLORS.primary} />
                      <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: COLORS.primary }}>
                        Pivoter
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  {selectedRun ? (
                    <TouchableOpacity
                      onPress={() => {
                        void Haptics.selectionAsync();
                        commitScene(rotateRun(scene, selectedRunKeyIndex));
                      }}
                      hitSlop={8}
                      style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                    >
                      <Icon name="rotate-right" size={20} color={COLORS.primary} />
                      <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: COLORS.primary }}>
                        Pivoter
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  {/* A single cabinet has three things it can have done to it,
                      so these are icons: the labels the run and the island can
                      afford would leave no room for the name of the meuble. */}
                  {selectedModule && !selectedIsIlot ? (
                    <TouchableOpacity
                      onPress={() => {
                        void Haptics.selectionAsync();
                        commitScene(rotateModule(scene, selectedKey!));
                      }}
                      accessibilityLabel="Pivoter ce meuble d'un quart de tour"
                      hitSlop={10}
                      style={{ paddingHorizontal: 2 }}
                    >
                      <Icon name="rotate-right" size={22} color={COLORS.primary} />
                    </TouchableOpacity>
                  ) : null}
                  {/* Only when it is out of its row: a caisson pulled out of a
                      side that has since been packed solid has nowhere to land
                      by hand, and dragging it back would simply fail. */}
                  {selectedModule && selectedIsFree ? (
                    <TouchableOpacity
                      onPress={() => {
                        void Haptics.selectionAsync();
                        commitScene(reseatModule(scene, selectedKey!));
                      }}
                      accessibilityLabel="Remettre ce meuble dans son côté"
                      hitSlop={10}
                      style={{ paddingHorizontal: 2 }}
                    >
                      <Icon name="backup-restore" size={22} color={COLORS.primary} />
                    </TouchableOpacity>
                  ) : null}
                  {selectedModule && !selectedIsIlot ? (
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        commitScene(removeModule(scene, targetRun, selectedKey!));
                        setSelectedKey(null);
                      }}
                      accessibilityLabel="Retirer ce meuble"
                      hitSlop={10}
                      style={{ paddingHorizontal: 2 }}
                    >
                      <Icon name="trash-can-outline" size={22} color={COLORS.error} />
                    </TouchableOpacity>
                  ) : null}
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingRight: 16 }}
                >
                  {MODULES.map((m) => {
                    const fits = fitsOnRun(scene, targetRun, m.id);
                    return (
                      <PressableScale
                        key={m.id}
                        disabled={!fits}
                        onPress={() => {
                          const next = addModule(scene, targetRun, m.id);
                          if (!next.key) return;
                          Haptics.selectionAsync();
                          commitScene(next.scene);
                          setSelectedKey(next.key);
                        }}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 12,
                          backgroundColor: COLORS.surfaceContainerLowest,
                          borderWidth: 1,
                          borderColor: COLORS.outlineVariant,
                          opacity: fits ? 1 : 0.38,
                          minWidth: 124,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: COLORS.onSurface }}>
                          {m.label}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            fontFamily: "Inter_400Regular",
                            color: COLORS.outline,
                            marginTop: 1,
                          }}
                        >
                          {fits ? `${m.widthMm} mm · mur ${targetRun + 1}` : "Ne rentre pas"}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </ScrollView>
              </>
            ) : (
              <Text
                style={{
                  fontSize: 12.5,
                  fontFamily: "Inter_400Regular",
                  color: COLORS.outline,
                  lineHeight: 18,
                }}
              >
                Tournez avec un doigt, pincez pour zoomer. LON / LAR règlent la taille de la
                pièce.
              </Text>
            )}
          </View>
        </View>

        {/* Inside the studio's Modal on purpose: a sheet rendered outside it
            would slide up behind the studio and never be seen. */}
        <IndicativeSheet
          visible={studioNoticeOpen}
          onClose={() => setStudioNoticeOpen(false)}
        />
      </Modal>

      <IndicativeSheet visible={noticeOpen} onClose={() => setNoticeOpen(false)} />
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
