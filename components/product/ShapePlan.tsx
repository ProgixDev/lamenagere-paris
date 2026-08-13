import React from "react";
import Svg, { G, Rect, Text as SvgText } from "react-native-svg";
import { COLORS } from "../../lib/constants";

/** Which measurement the customer is filling in right now. */
export type PlanHighlight = "run1" | "run2" | "run3" | "height" | "ilot" | null;

/**
 * The product seen from above, drawn live: the runs its shape actually has, the
 * island when there is one, and the segment being measured lit up.
 *
 * This replaces asking for "Longueur" / "Largeur" with no idea which wall is
 * meant — the customer types a number and sees exactly which run it belongs to.
 * Vector, so it stays sharp at any size and needs no uploaded asset.
 */
export default function ShapePlan({
  shapeKey,
  highlight = null,
  values = {},
  withIlot = false,
  heightLabel,
  height: h = 150,
}: {
  shapeKey?: string | null;
  highlight?: PlanHighlight;
  /** Entered centimetres per role, shown as a cote on the matching run. */
  values?: Partial<Record<"run1" | "run2" | "run3" | "height", number>>;
  withIlot?: boolean;
  /**
   * Label of the measurement tagged as the multiplier. It is a wall height on a
   * kitchen but a depth on a sofa, so the plan names it instead of drawing a
   * geometry that would be wrong for one of the two: it lights the whole
   * developed run, which is what the multiplier actually applies to.
   */
  heightLabel?: string;
  height?: number;
}) {
  const shape = shapeKey === "l" || shapeKey === "u" ? shapeKey : "i";
  const runs = shape === "u" ? 3 : shape === "l" ? 2 : 1;

  const idle = COLORS.surfaceContainer;
  const idleEdge = COLORS.outlineVariant;
  const on = COLORS.primary;

  const lit = (role: PlanHighlight) => highlight === role || highlight === "height";
  const fill = (role: PlanHighlight) => (lit(role) ? on : idle);
  const edge = (role: PlanHighlight) => (lit(role) ? on : idleEdge);
  const cote = (role: PlanHighlight) =>
    highlight === role ? COLORS.primary : COLORS.outline;

  return (
    <Svg width="100%" height={h} viewBox="0 0 200 140">
      {/* The room the product sits in, for scale. */}
      <Rect
        x={14}
        y={14}
        width={172}
        height={112}
        rx={6}
        fill="none"
        stroke={idleEdge}
        strokeWidth={1.4}
        strokeDasharray="5 5"
      />

      {/* Run 1 — the back wall, always present. */}
      <G>
        <Rect x={28} y={26} width={144} height={15} rx={3} fill={fill("run1")} stroke={edge("run1")} strokeWidth={1.2} />
        {values.run1 ? (
          <SvgText x={100} y={22} fontSize={9} fontWeight="600" fill={cote("run1")} textAnchor="middle">
            {values.run1} cm
          </SvgText>
        ) : null}
      </G>

      {/* Run 2 — the left return, on L and U. */}
      {runs >= 2 && (
        <G>
          <Rect x={28} y={41} width={15} height={70} rx={3} fill={fill("run2")} stroke={edge("run2")} strokeWidth={1.2} />
          {values.run2 ? (
            <SvgText x={20} y={80} fontSize={9} fontWeight="600" fill={cote("run2")} textAnchor="middle" transform="rotate(-90 20 80)">
              {values.run2} cm
            </SvgText>
          ) : null}
        </G>
      )}

      {/* Run 3 — the right return, U only. */}
      {runs >= 3 && (
        <G>
          <Rect x={157} y={41} width={15} height={70} rx={3} fill={fill("run3")} stroke={edge("run3")} strokeWidth={1.2} />
          {values.run3 ? (
            <SvgText x={180} y={80} fontSize={9} fontWeight="600" fill={cote("run3")} textAnchor="middle" transform="rotate(90 180 80)">
              {values.run3} cm
            </SvgText>
          ) : null}
        </G>
      )}

      {/* Island, only once the customer has asked for one. */}
      {withIlot && (
        <Rect
          x={78}
          y={68}
          width={46}
          height={26}
          rx={5}
          fill={highlight === "ilot" ? on : idle}
          stroke={highlight === "ilot" ? on : idleEdge}
          strokeWidth={1.2}
        />
      )}

      {/* The multiplier applies to the whole developed run, so the run lights up
          and the value is named rather than drawn as a geometry that would suit
          only a wall or only a seat. */}
      {highlight === "height" && (
        <SvgText x={100} y={136} fontSize={9} fontWeight="600" fill={on} textAnchor="middle">
          {heightLabel ?? "Hauteur"}
          {values.height ? ` : ${values.height} cm` : ""}
        </SvgText>
      )}
    </Svg>
  );
}
