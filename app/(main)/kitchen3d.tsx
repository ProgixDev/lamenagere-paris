import React, { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { CaretLeft } from "phosphor-react-native";
import Kitchen3D, { ZOOM_STEP, type Kitchen3DHandle } from "../../components/product/Kitchen3D";
import { buildScene, sceneBreakdown, sceneTotalCents } from "../../lib/kitchen3d/scene";
import { COLORS } from "../../lib/constants";
import { TYPE } from "../../lib/typography";

/**
 * A bench for the 3D step, not a shipping screen.
 *
 * The configure flow will feed the same `buildScene` from the customer's real
 * answers; this screen just exposes the knobs directly so the rendering can be
 * judged against every shape, colour and room size before it is wired in.
 */

const SHAPES = [
  { key: "i", label: "En I" },
  { key: "l", label: "En L" },
  { key: "u", label: "En U" },
];

const FACADES = [
  { hex: "#E8E4DC", label: "Blanc cassé" },
  { hex: "#2F3438", label: "Anthracite" },
  { hex: "#3F5148", label: "Vert sauge" },
  { hex: "#A8794C", label: "Chêne doré" },
  { hex: "#8E2F39", label: "Bordeaux" },
];

const WORKTOPS = [
  { hex: "#2E2E30", label: "Granit noir" },
  { hex: "#D9D5CD", label: "Quartz clair" },
  { hex: "#6E6B66", label: "Béton ciré" },
];

export default function Kitchen3DBench() {
  const router = useRouter();
  const [shapeKey, setShapeKey] = useState("l");
  const [ilot, setIlot] = useState(true);
  const [facade, setFacade] = useState(FACADES[0].hex);
  const [worktop, setWorktop] = useState(WORKTOPS[0].hex);
  const sceneRef = useRef<Kitchen3DHandle>(null);
  const [run1, setRun1] = useState("380");
  const [run2, setRun2] = useState("280");
  const [run3, setRun3] = useState("280");
  const [height, setHeight] = useState("250");

  const scene = useMemo(
    () =>
      buildScene({
        shapeKey,
        run1Cm: parseFloat(run1),
        run2Cm: parseFloat(run2),
        run3Cm: parseFloat(run3),
        heightCm: parseFloat(height),
        ilot,
        facadeHex: facade,
        worktopHex: worktop,
      }),
    [shapeKey, run1, run2, run3, height, ilot, facade, worktop],
  );

  const total = sceneTotalCents(scene);
  const breakdown = sceneBreakdown(scene);
  const euros = (cents: number) =>
    (cents / 100).toLocaleString("fr-FR", { maximumFractionDigits: 0 });

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <CaretLeft size={20} color={COLORS.onSurface} weight="bold" />
        </Pressable>
        <Text style={styles.title}>Aperçu 3D</Text>
        <Text style={styles.price}>{euros(total)} €</Text>
      </View>

      <View style={styles.canvas}>
        <Kitchen3D ref={sceneRef} scene={scene} />
        <View style={styles.zoomBar}>
          {([
            { key: "in", label: "+", factor: ZOOM_STEP.in },
            { key: "out", label: "−", factor: ZOOM_STEP.out },
          ] as const).map((z, i) => (
            <Pressable
              key={z.key}
              onPress={() => sceneRef.current?.zoom(z.factor)}
              style={[styles.zoomBtn, i === 1 && styles.zoomBtnDivider]}
            >
              <Text style={styles.zoomLabel}>{z.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView style={styles.panel} contentContainerStyle={styles.panelInner}>
        <Text style={styles.section}>Forme</Text>
        <View style={styles.row}>
          {SHAPES.map((s) => (
            <Pressable
              key={s.key}
              onPress={() => setShapeKey(s.key)}
              style={[styles.chip, shapeKey === s.key && styles.chipOn]}
            >
              <Text style={[styles.chipText, shapeKey === s.key && styles.chipTextOn]}>
                {s.label}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => setIlot((v) => !v)}
            style={[styles.chip, ilot && styles.chipOn]}
          >
            <Text style={[styles.chipText, ilot && styles.chipTextOn]}>Îlot</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>Mesures (cm)</Text>
        <View style={styles.row}>
          {[
            { label: "Mur 1", value: run1, set: setRun1 },
            { label: "Mur 2", value: run2, set: setRun2 },
            { label: "Mur 3", value: run3, set: setRun3 },
            { label: "Hauteur", value: height, set: setHeight },
          ].map((f) => (
            <View key={f.label} style={styles.field}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              <TextInput
                value={f.value}
                onChangeText={f.set}
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
          ))}
        </View>

        <Text style={styles.section}>Façades</Text>
        <View style={styles.row}>
          {FACADES.map((c) => (
            <Pressable
              key={c.hex}
              onPress={() => setFacade(c.hex)}
              style={[styles.swatch, { backgroundColor: c.hex }, facade === c.hex && styles.swatchOn]}
            />
          ))}
        </View>

        <Text style={styles.section}>Plan de travail</Text>
        <View style={styles.row}>
          {WORKTOPS.map((c) => (
            <Pressable
              key={c.hex}
              onPress={() => setWorktop(c.hex)}
              style={[styles.swatch, { backgroundColor: c.hex }, worktop === c.hex && styles.swatchOn]}
            />
          ))}
        </View>

        <Text style={styles.section}>Détail</Text>
        {breakdown.map((line) => (
          <View key={line.module.id} style={styles.line}>
            <Text style={styles.lineLabel}>
              {line.quantity} × {line.module.label}
            </Text>
            <Text style={styles.linePrice}>{euros(line.totalCents)} €</Text>
          </View>
        ))}
        <View style={[styles.line, styles.totalLine]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{euros(total)} €</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  back: { padding: 4 },
  title: { ...TYPE.sectionTitle, color: COLORS.onSurface, flex: 1 },
  price: { ...TYPE.price, color: COLORS.primary },
  canvas: { height: "46%", backgroundColor: "#EFEDE9" },
  zoomBar: {
    position: "absolute",
    right: 12,
    bottom: 12,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
  },
  zoomBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  zoomBtnDivider: { borderTopWidth: 1, borderTopColor: COLORS.outlineVariant },
  zoomLabel: { fontSize: 19, fontWeight: "500", color: COLORS.onSurface, lineHeight: 22 },
  panel: { flex: 1 },
  panelInner: { padding: 16, paddingBottom: 40, gap: 10 },
  section: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: COLORS.onSurfaceVariant,
    marginTop: 8,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceContainer,
  },
  chipOn: { backgroundColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: "600", color: COLORS.onSurfaceVariant },
  chipTextOn: { color: COLORS.onPrimary },
  field: { gap: 4 },
  fieldLabel: { fontSize: 11, color: COLORS.onSurfaceVariant },
  input: {
    width: 74,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceContainer,
    fontSize: 14,
    color: COLORS.onSurface,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.outlineVariant,
  },
  swatchOn: { borderWidth: 3, borderColor: COLORS.primary },
  line: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  lineLabel: { fontSize: 13, color: COLORS.onSurfaceVariant, flex: 1 },
  linePrice: { fontSize: 13, color: COLORS.onSurface, fontWeight: "600" },
  totalLine: {
    borderTopWidth: 1,
    borderTopColor: COLORS.outlineVariant,
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: { ...TYPE.price, color: COLORS.onSurface },
  totalValue: { ...TYPE.price, color: COLORS.primary },
});
