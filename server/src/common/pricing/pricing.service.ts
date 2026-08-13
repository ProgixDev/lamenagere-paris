import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  ConfigBlock,
  ConfigBlockItem,
  ConfigBlockOption,
  ConfigSelectionEntry,
} from '../../modules/catalog/catalog.serializer';
import {
  areaFormula,
  dimensionsFromShape,
  type AreaDimensions,
  type AreaFormulaKey,
} from './area-formulas';

export type PriceMode = 'fixed' | 'calculated' | 'per_sqm' | 'quote';

/** One quality tier for a per_sqm product, with its own €/m² rate. */
export interface QualityTierOption {
  key: string;
  label: string;
  price_per_sqm_cents: number;
}

/** Minimal pricing-relevant fields from a product row. */
export interface PricingProduct {
  price_mode: PriceMode;
  base_price_cents: number | null;
  width_coef_cents: number | null;
  height_coef_cents: number | null;
  price_per_sqm_cents: number | null;
  ref_width: number | null;
  ref_height: number | null;
  min_width: number | null;
  min_height: number | null;
  max_width: number | null;
  max_height: number | null;
  quality_tiers?: QualityTierOption[] | null;
  /**
   * Which dimensions a per_sqm product is billed on. Absent/unknown falls back
   * to the historical largeur × hauteur.
   */
  area_formula?: AreaFormulaKey | string | null;
}

/**
 * Customer-entered dimensions in centimetres. Every field is optional: which
 * ones are required depends on the product's area formula (per_sqm) or is
 * width + height (calculated). Missing required dimensions are rejected at
 * pricing time with a message naming the field.
 */
export type CustomDimensions = AreaDimensions;

/**
 * Resolves the authoritative unit price (in cents) for a product. Always called
 * server-side at checkout — the client's calculatedPrice is display-only and is
 * never trusted.
 *
 * - fixed:      base_price_cents
 * - calculated: base + widthCoef*(w - refW) + heightCoef*(h - refH), dimensions
 *               clamped to [min,max], result rounded to whole euros.
 * - per_sqm:    area(m²) × price_per_sqm, dimensions clamped to [min,max],
 *               result rounded to whole euros.
 * - quote:      not purchasable directly -> caller must route to a devis.
 *
 * Option surcharges (openings included) come from the product's configuration
 * blocks and are priced by `priceConfiguration`, not from this method.
 */
/**
 * Whether a block is meant for this product. Kept next to the pricing so the
 * server never bills a block the app was right not to show.
 */
export function blockApplies(
  block: { appliesTo?: 'all' | 'sqm' | 'fixed' },
  isPerSqm: boolean,
): boolean {
  const a = block.appliesTo ?? 'all';
  if (a === 'sqm') return isPerSqm;
  if (a === 'fixed') return !isPerSqm;
  return true;
}

@Injectable()
export class PricingService {
  resolveUnitPriceCents(
    product: PricingProduct,
    customDimensions?: CustomDimensions | null,
    qualityTier?: string | null,
  ): number {
    return this.resolveBaseCents(product, customDimensions, qualityTier);
  }

  /**
   * Re-prices the customer's config-block selections against the category's
   * authoritative blocks (never trusting client-sent prices) and rebuilds a
   * clean snapshot to store on the order line. Unknown blocks/keys are skipped
   * so a stale selection can't break checkout.
   */
  priceConfiguration(
    blocks: ConfigBlock[],
    selection?: ConfigSelectionEntry[] | null,
  ): { surchargeCents: number; snapshot: ConfigSelectionEntry[] } {
    if (!selection?.length || !blocks?.length) {
      return { surchargeCents: 0, snapshot: [] };
    }
    const byId = new Map(blocks.map((b) => [b.id, b]));
    let surchargeCents = 0;
    const snapshot: ConfigSelectionEntry[] = [];

    for (const sel of selection) {
      const block = byId.get(sel.blockId);
      if (!block) continue;
      const entry: ConfigSelectionEntry = {
        blockId: block.id,
        type: block.type,
        label: block.label,
      };
      let touched = false;

      if (block.type === 'measurements' && sel.measurements?.length) {
        const ms = this.clampMeasurements(block, sel.measurements);
        if (ms.length) {
          entry.measurements = ms;
          touched = true;
        }
      } else if (block.type === 'ilot' && sel.ilot?.included) {
        // The island is priced on its own measurements, at its own rate —
        // never from the product's gamme. A declined island (included false,
        // only possible when the block isn't required) bills nothing and is
        // left out of the snapshot entirely.
        const ms = this.clampMeasurements(block, sel.measurements);
        const cents = this.ilotSurchargeCents(block, ms);
        if (ms.length) entry.measurements = ms;
        entry.ilot = { included: true, surchargeCents: cents, image: block.planImage };
        surchargeCents += cents;
        touched = true;
      } else if (block.type === 'shape' && sel.shape) {
        const opt = (block.options ?? []).find((o) => o.key === sel.shape!.key);
        if (opt) {
          entry.shape = { key: opt.key, label: opt.label, image: opt.image };
          touched = true;
        }
      } else if (block.type === 'colors' && sel.colors?.length) {
        const opts = block.options ?? [];
        const colors = sel.colors
          .map((c) => opts.find((o) => o.key === c.key))
          .filter((o): o is ConfigBlockOption => !!o)
          .map((o) => ({
            key: o.key,
            label: o.label,
            surchargeCents: o.surchargeCents,
            image: o.image,
            hex: o.hex,
          }));
        colors.forEach((c) => (surchargeCents += c.surchargeCents ?? 0));
        if (colors.length) {
          entry.colors = colors;
          touched = true;
        }
      } else if (block.type === 'accessories' && sel.accessories?.length) {
        const items = block.items ?? [];
        const accs = sel.accessories
          .map((a) => items.find((i) => i.id === a.id))
          .filter((i): i is ConfigBlockItem => !!i)
          .map((i) => ({ id: i.id, title: i.title, priceCents: i.priceCents, image: i.image }));
        accs.forEach((a) => (surchargeCents += a.priceCents ?? 0));
        if (accs.length) {
          entry.accessories = accs;
          touched = true;
        }
      } else if (block.type === 'opening_details' && sel.opening) {
        const opt = (block.options ?? []).find((o) => o.key === sel.opening!.key);
        if (opt) {
          entry.opening = {
            key: opt.key,
            label: opt.label,
            surchargeCents: opt.surchargeCents,
            image: opt.image,
          };
          surchargeCents += opt.surchargeCents ?? 0;
          touched = true;
        }
      } else if (block.type === 'photos' && sel.photos?.length) {
        const photos = sel.photos
          .filter((p) => typeof p?.url === 'string')
          .map((p) => ({ url: p.url, type: p.type === 'video' ? ('video' as const) : ('image' as const) }));
        if (photos.length) {
          entry.photos = photos;
          touched = true;
        }
      }

      if (touched) snapshot.push(entry);
    }

    return { surchargeCents, snapshot };
  }

  /**
   * Client-sent measurements, kept only when the authoritative block declares
   * the field, and clamped to its bounds. Labels and units come from the block,
   * never from the client.
   */
  private clampMeasurements(
    block: ConfigBlock,
    measurements?: ConfigSelectionEntry['measurements'],
  ): NonNullable<ConfigSelectionEntry['measurements']> {
    const fields = new Map((block.fields ?? []).map((f) => [f.key, f]));
    return (measurements ?? [])
      .map((m) => {
        const f = fields.get(m.key);
        let v = Number(m.value);
        if (!f || !Number.isFinite(v)) return null;
        if (f.min != null && v < f.min) v = f.min;
        if (f.max != null && v > f.max) v = f.max;
        return { key: f.key, label: f.label, value: v, unit: f.unit };
      })
      .filter((m): m is NonNullable<typeof m> => m != null);
  }

  /**
   * What an island costs: either a flat supplement, or its own surface (built
   * from the fields the block tags with a `dimensionKey`, through the block's
   * own area formula) at its own €/m². Rounded like every other area price.
   */
  private ilotSurchargeCents(
    block: ConfigBlock,
    measurements: NonNullable<ConfigSelectionEntry['measurements']>,
  ): number {
    if (block.priceMode !== 'per_sqm') {
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
    // Every dimension the formula bills must be present, else the island isn't
    // measurable yet and bills nothing rather than a partial surface.
    if (formula.fields.some((f) => !((dims[f.key] ?? 0) > 0))) return 0;
    // Rounded to whole euros, like every other per-m² price.
  return Math.max(0, Math.round((formula.areaM2(dims) * rate) / 100) * 100);
  }

  /**
   * Billable dimensions for a shape-driven product, read from the customer's
   * own config-block answers rather than from a separate set of inputs.
   *
   * Measurement values are taken from the client selection but the *roles* come
   * from the authoritative blocks, so a client can't retag which measurement
   * counts as a billed pan. Values are clamped to each field's bounds, exactly
   * as priceConfiguration does when snapshotting them.
   */
  dimensionsFromSelection(
    blocks: ConfigBlock[],
    selection?: ConfigSelectionEntry[] | null,
  ): AreaDimensions {
    const values: Record<string, number> = {};
    let shapeKey: string | undefined;

    const byId = new Map((blocks ?? []).map((b) => [b.id, b]));
    for (const sel of selection ?? []) {
      const block = byId.get(sel.blockId);
      if (!block) continue;
      if (block.type === 'measurements') {
        const fields = new Map((block.fields ?? []).map((f) => [f.key, f]));
        for (const m of sel.measurements ?? []) {
          const field = fields.get(m.key);
          let v = Number(m.value);
          if (!field || !Number.isFinite(v)) continue;
          if (field.min != null && v < field.min) v = field.min;
          if (field.max != null && v > field.max) v = field.max;
          values[field.key] = v;
        }
      }
      if (block.type === 'shape' && sel.shape?.key) {
        shapeKey = sel.shape.key;
      }
    }

    return dimensionsFromShape(blocks, values, shapeKey);
  }

  private resolveBaseCents(
    product: PricingProduct,
    customDimensions?: CustomDimensions | null,
    qualityTier?: string | null,
  ): number {
    switch (product.price_mode) {
      case 'fixed':
        if (product.base_price_cents == null) {
          throw new BadRequestException('Prix du produit indisponible');
        }
        return product.base_price_cents;

      case 'calculated':
        return this.resolveCalculated(product, customDimensions);

      case 'per_sqm':
        return this.resolvePerSqm(product, customDimensions, qualityTier);

      case 'quote':
        throw new BadRequestException(
          'Ce produit est disponible uniquement sur devis',
        );

      default:
        throw new BadRequestException('Mode de tarification inconnu');
    }
  }

  /**
   * per_sqm: area(m²) × €/m², clamped dims, rounded to whole euros.
   *
   * When the product offers quality tiers, the chosen tier's rate is used and a
   * valid tier must be supplied. Products without tiers fall back to the flat
   * price_per_sqm_cents.
   */
  private resolvePerSqm(
    product: PricingProduct,
    dims?: CustomDimensions | null,
    qualityTier?: string | null,
  ): number {
    const rate = this.perSqmRateCents(product, qualityTier);
    if (!dims) {
      throw new BadRequestException('Dimensions requises');
    }
    const formula = areaFormula(product.area_formula);

    // Formulas with no fields of their own (by_shape) are fed dimensions this
    // service already derived from the customer's configuration, which were
    // clamped to each measurement field's own bounds on the way in. There is
    // nothing further to collect or re-validate here.
    if (formula.fields.length === 0) {
      if (!((dims.width ?? 0) > 0) || !((dims.height ?? 0) > 0)) {
        throw new BadRequestException(
          'Renseignez la forme et les mesures pour obtenir le prix',
        );
      }
      return Math.max(0, Math.round((formula.areaM2(dims) * rate) / 100) * 100);
    }

    // Only the dimensions this formula asks for are read, validated and billed.
    // Anything else the client sent is ignored, so a stale app that still posts
    // width+height can't smuggle an unpriced dimension into the total.
    const checked: AreaDimensions = {};
    for (const field of formula.fields) {
      const value = dims[field.key];
      if (value == null || !Number.isFinite(value)) {
        throw new BadRequestException(
          `${this.capitalize(field.errorLabel)} est requise`,
        );
      }
      const [min, max] =
        field.axis === 'vertical'
          ? [product.min_height, product.max_height]
          : [product.min_width, product.max_width];
      checked[field.key] = this.checkRange(value, min, max, field.errorLabel);
    }

    const raw = formula.areaM2(checked) * rate;
    // Round to whole euros.
    return Math.max(0, Math.round(raw / 100) * 100);
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /** Resolves the effective €/m² rate (cents), validating the chosen tier. */
  private perSqmRateCents(
    product: PricingProduct,
    qualityTier?: string | null,
  ): number {
    const tiers = product.quality_tiers ?? [];
    if (tiers.length > 0) {
      if (!qualityTier) {
        throw new BadRequestException('Gamme requise');
      }
      const match = tiers.find((t) => t.key === qualityTier);
      if (!match) {
        throw new BadRequestException('Gamme invalide');
      }
      return match.price_per_sqm_cents;
    }
    if (product.price_per_sqm_cents == null) {
      throw new BadRequestException('Prix au m² indisponible');
    }
    return product.price_per_sqm_cents;
  }

  private resolveCalculated(
    product: PricingProduct,
    dims?: CustomDimensions | null,
  ): number {
    const base = product.base_price_cents ?? 0;
    if (!dims) {
      // No custom dimensions -> price at reference dimensions = base price.
      return base;
    }

    if (dims.width == null || dims.height == null) {
      throw new BadRequestException('Largeur et hauteur requises');
    }
    const width = this.checkRange(
      dims.width,
      product.min_width,
      product.max_width,
      'la largeur',
    );
    const height = this.checkRange(
      dims.height,
      product.min_height,
      product.max_height,
      'la hauteur',
    );

    const refW = product.ref_width ?? 0;
    const refH = product.ref_height ?? 0;
    const widthCoef = product.width_coef_cents ?? 0;
    const heightCoef = product.height_coef_cents ?? 0;

    const raw =
      base + widthCoef * (width - refW) + heightCoef * (height - refH);

    // Round to whole euros.
    return Math.max(0, Math.round(raw / 100) * 100);
  }

  /**
   * Rejects an out-of-range dimension. `label` carries its own article
   * ("la largeur", "la longueur du fond") because the formulas name several
   * dimensions and not all of them read well after a fixed "La ".
   */
  private checkRange(
    value: number,
    min: number | null,
    max: number | null,
    label: string,
  ): number {
    if (min != null && value < min) {
      throw new BadRequestException(
        `${this.capitalize(label)} doit être au moins ${min} cm`,
      );
    }
    if (max != null && value > max) {
      throw new BadRequestException(
        `${this.capitalize(label)} ne peut pas dépasser ${max} cm`,
      );
    }
    return value;
  }
}
