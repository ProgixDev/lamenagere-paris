import type {
  ConfigBlock,
  ConfigSelectionEntry,
  ItemConfiguration,
} from "./types";
import {
  areaFormula,
  dimensionsFromShape,
  type AreaDimensions,
} from "./area-formulas";

/** Raw, per-block input the customer is editing on the product screen. */
export interface BlockSelection {
  measurements?: Record<string, string>; // fieldKey -> raw text input
  shapeKey?: string;
  colorKeys?: string[];
  accessoryIds?: string[];
  openingKey?: string;
  optionKeys?: string[];
  /** `ilot` blocks: whether the customer wants an island at all. */
  ilotIncluded?: boolean;
  photos?: { url: string; type: "image" | "video" }[];
}
export type ConfigState = Record<string, BlockSelection>; // blockId -> selection

/**
 * Turns the raw selection state into a display snapshot (labels + prices),
 * dropping blocks the customer didn't touch. The server rebuilds this
 * authoritatively at checkout — this copy is for the cart UI + live price.
 */
export function buildConfiguration(
  blocks: ConfigBlock[],
  state: ConfigState,
): ItemConfiguration {
  const out: ItemConfiguration = [];
  for (const block of blocks) {
    const sel = state[block.id];
    if (!sel) continue;
    const entry: ConfigSelectionEntry = {
      blockId: block.id,
      type: block.type,
      label: block.label,
    };
    let touched = false;

    if (block.type === "measurements") {
      const measurements = (block.fields ?? [])
        .map((f) => {
          const raw = sel.measurements?.[f.key];
          const value = raw != null && raw !== "" ? parseFloat(raw) : NaN;
          return Number.isFinite(value)
            ? { key: f.key, label: f.label, value, unit: f.unit }
            : null;
        })
        .filter((m): m is NonNullable<typeof m> => m != null);
      if (measurements.length) {
        entry.measurements = measurements;
        touched = true;
      }
    } else if (block.type === "ilot") {
      // A required island is always in; an optional one only once the customer
      // says yes. Declining bills nothing and records nothing.
      const included = block.required ? true : sel.ilotIncluded === true;
      if (included) {
        const measurements = (block.fields ?? [])
          .map((f) => {
            const raw = sel.measurements?.[f.key];
            const value = raw != null && raw !== "" ? parseFloat(raw) : NaN;
            return Number.isFinite(value)
              ? { key: f.key, label: f.label, value, unit: f.unit }
              : null;
          })
          .filter((m): m is NonNullable<typeof m> => m != null);
        if (measurements.length) entry.measurements = measurements;
        entry.ilot = { included: true, surchargeCents: ilotSurchargeCents(block, measurements) };
        touched = true;
      }
    } else if (block.type === "shape") {
      const opt = (block.options ?? []).find((o) => o.key === sel.shapeKey);
      if (opt) {
        entry.shape = { key: opt.key, label: opt.label };
        touched = true;
      }
    } else if (block.type === "colors") {
      const colors = (block.options ?? [])
        .filter((o) => sel.colorKeys?.includes(o.key))
        .map((o) => ({ key: o.key, label: o.label, surchargeCents: o.surchargeCents }));
      if (colors.length) {
        entry.colors = colors;
        touched = true;
      }
    } else if (block.type === "accessories") {
      const accessories = (block.items ?? [])
        .filter((it) => sel.accessoryIds?.includes(it.id))
        .map((it) => ({ id: it.id, title: it.title, priceCents: it.priceCents }));
      if (accessories.length) {
        entry.accessories = accessories;
        touched = true;
      }
    } else if (block.type === "opening_details") {
      const opt = (block.options ?? []).find((o) => o.key === sel.openingKey);
      if (opt) {
        entry.opening = { key: opt.key, label: opt.label, surchargeCents: opt.surchargeCents };
        touched = true;
      }
    } else if (block.type === "options") {
      const options = (block.options ?? [])
        .filter((o) => sel.optionKeys?.includes(o.key))
        .map((o) => ({ key: o.key, label: o.label, surchargeCents: o.surchargeCents, image: o.image }));
      if (options.length) {
        entry.options = options;
        touched = true;
      }
    } else if (block.type === "photos") {
      if (sel.photos?.length) {
        entry.photos = sel.photos;
        touched = true;
      }
    }

    if (touched) out.push(entry);
  }
  return out;
}

/** Total add-on surcharge (euros) from selected colors, accessories, openings. */
export function configSurchargeEuros(configuration: ItemConfiguration): number {
  let cents = 0;
  for (const e of configuration) {
    e.colors?.forEach((c) => (cents += c.surchargeCents ?? 0));
    e.accessories?.forEach((a) => (cents += a.priceCents ?? 0));
    e.options?.forEach((o) => (cents += o.surchargeCents ?? 0));
    if (e.opening?.surchargeCents) cents += e.opening.surchargeCents;
    if (e.ilot?.included) cents += e.ilot.surchargeCents ?? 0;
  }
  return cents / 100;
}

/** Validates required blocks; returns the first missing-field hint, if any. */
export function configValidation(
  blocks: ConfigBlock[],
  state: ConfigState,
): { ok: boolean; hint?: string } {
  for (const block of blocks) {
    if (!block.required) continue;
    const sel = state[block.id];
    const missing = () => ({ ok: false, hint: `Renseignez : ${block.label}` });
    if (block.type === "measurements") {
      const fields = block.fields ?? [];
      const allFilled = fields.every((f) => {
        const raw = sel?.measurements?.[f.key];
        return raw != null && raw !== "" && Number.isFinite(parseFloat(raw));
      });
      if (!fields.length || !allFilled) return missing();
    } else if (block.type === "ilot") {
      // Only reachable when the block is required, i.e. the island is part of
      // the model: then every measurement it asks for must be filled.
      const fields = block.fields ?? [];
      const allFilled = fields.every((f) => {
        const raw = sel?.measurements?.[f.key];
        return raw != null && raw !== "" && Number.isFinite(parseFloat(raw));
      });
      if (!allFilled) return missing();
    } else if (block.type === "shape") {
      if (!sel?.shapeKey) return missing();
    } else if (block.type === "colors") {
      if (!sel?.colorKeys?.length) return missing();
    } else if (block.type === "accessories") {
      if (!sel?.accessoryIds?.length) return missing();
    } else if (block.type === "opening_details") {
      if (!sel?.openingKey) return missing();
    } else if (block.type === "options") {
      if (!sel?.optionKeys?.length) return missing();
    } else if (block.type === "photos") {
      if (!sel?.photos?.length) return missing();
    }
  }
  return { ok: true };
}

/** Short one-line summary of a configuration for cart/order list rows. */
export function summarizeConfiguration(config: ItemConfiguration): string {
  const parts: string[] = [];
  for (const e of config) {
    if (e.measurements?.length) {
      parts.push(e.measurements.map((m) => `${m.label} ${m.value}${m.unit ?? ""}`).join(", "));
    }
    if (e.ilot?.included) parts.push("avec îlot");
    if (e.shape) parts.push(e.shape.label);
    if (e.colors?.length) parts.push(e.colors.map((c) => c.label).join("/"));
    if (e.opening) parts.push(e.opening.label);
    if (e.options?.length) parts.push(e.options.map((o) => o.label).join(", "));
    if (e.accessories?.length) parts.push(`${e.accessories.length} accessoire(s)`);
    if (e.photos?.length) parts.push(`${e.photos.length} photo(s)`);
  }
  return parts.join(" · ");
}

/**
 * Billable dimensions for a shape-driven per-m² product, read straight from
 * what the customer is typing into the configuration blocks. Mirrors the
 * server's PricingService.dimensionsFromSelection so the live price and the
 * charged price agree.
 */
export function dimensionsFromConfigState(
  blocks: ConfigBlock[],
  state: ConfigState,
): AreaDimensions {
  const values: Record<string, number> = {};
  let shapeKey: string | undefined;

  for (const block of blocks) {
    const sel = state[block.id];
    if (!sel) continue;
    if (block.type === "measurements") {
      for (const field of block.fields ?? []) {
        const raw = sel.measurements?.[field.key];
        let v = parseFloat(raw ?? "");
        if (!Number.isFinite(v)) continue;
        if (field.min != null && v < field.min) v = field.min;
        if (field.max != null && v > field.max) v = field.max;
        values[field.key] = v;
      }
    }
    if (block.type === "shape" && sel.shapeKey) shapeKey = sel.shapeKey;
  }

  return dimensionsFromShape(blocks, values, shapeKey);
}

/**
 * What an island costs, mirroring PricingService.ilotSurchargeCents so the live
 * price and the charged price agree. Either a flat supplement, or its own
 * surface — built from the fields tagged with a `dimensionKey` — at its own
 * rate. An incomplete island bills nothing rather than a partial surface.
 */
export function ilotSurchargeCents(
  block: ConfigBlock,
  measurements: { key: string; value: number }[],
): number {
  if (block.priceMode !== "per_sqm") {
    return Math.max(0, Math.round(block.priceCents ?? 0));
  }
  const rate = block.pricePerSqmCents ?? 0;
  if (rate <= 0) return 0;

  const byKey = new Map((block.fields ?? []).map((f) => [f.key, f]));
  const dims: AreaDimensions = {};
  for (const m of measurements) {
    const key = byKey.get(m.key)?.dimensionKey;
    if (key) dims[key] = m.value;
  }
  const formula = areaFormula(block.areaFormula);
  if (formula.fields.some((f) => !((dims[f.key] ?? 0) > 0))) return 0;
  // Rounded to whole euros, like every other per-m² price.
  return Math.max(0, Math.round((formula.areaM2(dims) * rate) / 100) * 100);
}

/** One printable line of an order's configuration recap. */
export interface RecapRow {
  label: string;
  value: string;
  /** Surcharge this line carries, in cents. */
  priceCents?: number;
  /** Indented detail under the block it belongs to (a single measurement). */
  sub?: boolean;
}

/**
 * Turns a stored configuration into readable label → value lines, one block at
 * a time, with the surcharge each one carried.
 *
 * The old one-line summary joined everything with " · ", which for a kitchen
 * meant ten blocks squashed into two truncated lines — the customer could not
 * check what they had ordered, and the workshop could not read it back.
 */
export function configRecapRows(config?: ItemConfiguration | null): RecapRow[] {
  const rows: RecapRow[] = [];
  const sum = (xs: { surchargeCents?: number }[]) =>
    xs.reduce((n, x) => n + (x.surchargeCents ?? 0), 0);

  for (const e of config ?? []) {
    const measurements = e.measurements ?? [];
    const detail = () =>
      measurements.forEach((m) =>
        rows.push({ label: m.label, value: `${m.value} ${m.unit ?? "cm"}`, sub: true }),
      );

    if (e.type === "ilot") {
      if (!e.ilot?.included) continue;
      rows.push({ label: e.label, value: "Oui", priceCents: e.ilot.surchargeCents });
      detail();
    } else if (e.type === "measurements") {
      if (!measurements.length) continue;
      rows.push({ label: e.label, value: "" });
      detail();
    } else if (e.shape) {
      rows.push({ label: e.label, value: e.shape.label });
    } else if (e.colors?.length) {
      rows.push({
        label: e.label,
        value: e.colors.map((c) => c.label).join(", "),
        priceCents: sum(e.colors),
      });
    } else if (e.opening) {
      rows.push({
        label: e.label,
        value: e.opening.label,
        priceCents: e.opening.surchargeCents,
      });
    } else if (e.accessories?.length) {
      rows.push({
        label: e.label,
        value: e.accessories.map((a) => a.title.trim()).join(", "),
        priceCents: e.accessories.reduce((n, a) => n + (a.priceCents ?? 0), 0),
      });
    } else if (e.options?.length) {
      rows.push({
        label: e.label,
        value: e.options.map((o) => o.label).join(", "),
        priceCents: sum(e.options),
      });
    } else if (e.photos?.length) {
      rows.push({
        label: e.label,
        value: `${e.photos.length} fichier${e.photos.length > 1 ? "s" : ""}`,
      });
    }
  }
  return rows;
}

/**
 * Whether a block is meant for this product. Mirrors the server's
 * `blockApplies` so the app never shows a step the server would refuse to
 * price — and never hides one it would.
 */
export function blockApplies(block: ConfigBlock, isPerSqm: boolean): boolean {
  const a = block.appliesTo ?? "all";
  if (a === "sqm") return isPerSqm;
  if (a === "fixed") return !isPerSqm;
  return true;
}
