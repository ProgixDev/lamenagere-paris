import type {
  ConfigBlock,
  ConfigSelectionEntry,
  ItemConfiguration,
} from "./types";

/** Raw, per-block input the customer is editing on the product screen. */
export interface BlockSelection {
  measurements?: Record<string, string>; // fieldKey -> raw text input
  shapeKey?: string;
  colorKeys?: string[];
  accessoryIds?: string[];
  openingKey?: string;
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
    if (e.opening?.surchargeCents) cents += e.opening.surchargeCents;
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
    } else if (block.type === "shape") {
      if (!sel?.shapeKey) return missing();
    } else if (block.type === "colors") {
      if (!sel?.colorKeys?.length) return missing();
    } else if (block.type === "accessories") {
      if (!sel?.accessoryIds?.length) return missing();
    } else if (block.type === "opening_details") {
      if (!sel?.openingKey) return missing();
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
    if (e.shape) parts.push(e.shape.label);
    if (e.colors?.length) parts.push(e.colors.map((c) => c.label).join("/"));
    if (e.opening) parts.push(e.opening.label);
    if (e.accessories?.length) parts.push(`${e.accessories.length} accessoire(s)`);
    if (e.photos?.length) parts.push(`${e.photos.length} photo(s)`);
  }
  return parts.join(" · ");
}
