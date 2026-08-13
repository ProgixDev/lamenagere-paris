import { BadRequestException } from '@nestjs/common';
import { PricingService, PricingProduct } from './pricing.service';
import type {
  ConfigBlock,
  ConfigSelectionEntry,
} from '../../modules/catalog/catalog.serializer';

const calculated: PricingProduct = {
  price_mode: 'calculated',
  base_price_cents: 385000, // 3 850 €
  width_coef_cents: 850, //  8,50 €/cm
  height_coef_cents: 620, // 6,20 €/cm
  price_per_sqm_cents: null,
  ref_width: 200,
  ref_height: 220,
  min_width: 80,
  min_height: 80,
  max_width: 400,
  max_height: 400,
};

const perSqm: PricingProduct = {
  price_mode: 'per_sqm',
  base_price_cents: null,
  width_coef_cents: null,
  height_coef_cents: null,
  price_per_sqm_cents: 10000, // 100 €/m²
  ref_width: null,
  ref_height: null,
  min_width: 50,
  min_height: 50,
  max_width: 400,
  max_height: 400,
};

describe('PricingService', () => {
  const svc = new PricingService();

  it('returns the fixed price as-is', () => {
    expect(
      svc.resolveUnitPriceCents({
        ...calculated,
        price_mode: 'fixed',
        base_price_cents: 289000,
      }),
    ).toBe(289000);
  });

  it('returns base price at reference dimensions', () => {
    expect(
      svc.resolveUnitPriceCents(calculated, { width: 200, height: 220 }),
    ).toBe(385000);
  });

  it('adds coefficient deltas above reference and rounds to whole euros', () => {
    // +50cm width * 8.50 = 425€ ; +30cm height * 6.20 = 186€ ; total 3850+611
    const price = svc.resolveUnitPriceCents(calculated, {
      width: 250,
      height: 250,
    });
    expect(price).toBe(446100); // 4 461 €
  });

  it('rejects dimensions beyond the configured maximum', () => {
    expect(() =>
      svc.resolveUnitPriceCents(calculated, { width: 999, height: 250 }),
    ).toThrow(BadRequestException);
  });

  it('refuses to price quote-only products', () => {
    expect(() =>
      svc.resolveUnitPriceCents({ ...calculated, price_mode: 'quote' }),
    ).toThrow(BadRequestException);
  });

  it('prices per m² (area × rate) rounded to whole euros', () => {
    // 2 m × 2 m = 4 m² × 100 €/m² = 400 €
    expect(
      svc.resolveUnitPriceCents(perSqm, { width: 200, height: 200 }),
    ).toBe(40000);
  });

  it('per_sqm requires dimensions', () => {
    expect(() => svc.resolveUnitPriceCents(perSqm)).toThrow(BadRequestException);
  });

  it('per_sqm clamps below the minimum', () => {
    expect(() =>
      svc.resolveUnitPriceCents(perSqm, { width: 10, height: 200 }),
    ).toThrow(BadRequestException);
  });

  const tiered: PricingProduct = {
    ...perSqm,
    price_per_sqm_cents: null, // no flat rate — tiers drive the price
    quality_tiers: [
      { key: 'bas', label: 'Bas de gamme', price_per_sqm_cents: 8000 }, // 80 €/m²
      { key: 'haute', label: 'Haute de gamme', price_per_sqm_cents: 18000 }, // 180 €/m²
    ],
  };

  it('prices per m² using the chosen quality tier rate', () => {
    // 4 m² × 80 €/m² = 320 € ; 4 m² × 180 €/m² = 720 €
    expect(
      svc.resolveUnitPriceCents(tiered, { width: 200, height: 200 }, 'bas'),
    ).toBe(32000);
    expect(
      svc.resolveUnitPriceCents(tiered, { width: 200, height: 200 }, 'haute'),
    ).toBe(72000);
  });

  it('requires a quality tier when the product offers them', () => {
    expect(() =>
      svc.resolveUnitPriceCents(tiered, { width: 200, height: 200 }),
    ).toThrow(BadRequestException);
  });

  it('rejects an unknown quality tier', () => {
    expect(() =>
      svc.resolveUnitPriceCents(tiered, { width: 200, height: 200 }, 'bogus'),
    ).toThrow(BadRequestException);
  });

  // ── Area formulas ────────────────────────────────────────────────────────
  describe('area formulas', () => {
    it('defaults to largeur × hauteur when no formula is set', () => {
      // 2 m × 2 m = 4 m² × 100 €/m² = 400 €
      expect(svc.resolveUnitPriceCents(perSqm, { width: 200, height: 200 })).toBe(
        40000,
      );
    });

    it('treats an unknown formula as largeur × hauteur', () => {
      const bogus: PricingProduct = { ...perSqm, area_formula: 'not_a_formula' };
      expect(svc.resolveUnitPriceCents(bogus, { width: 200, height: 200 })).toBe(
        40000,
      );
    });

    it('prices tiles on the floor area (largeur × longueur)', () => {
      const tiles: PricingProduct = { ...perSqm, area_formula: 'width_length' };
      // 3 m × 2 m = 6 m² × 100 €/m² = 600 €
      expect(
        svc.resolveUnitPriceCents(tiles, { width: 300, length: 200 }),
      ).toBe(60000);
    });

    it('ignores a height that the tile formula does not bill', () => {
      const tiles: PricingProduct = { ...perSqm, area_formula: 'width_length' };
      expect(
        svc.resolveUnitPriceCents(tiles, { width: 300, length: 200, height: 999 }),
      ).toBe(60000);
    });

    it('prices an L-shaped kitchen on the developed run', () => {
      const kitchen: PricingProduct = { ...perSqm, area_formula: 'l_shape' };
      // (3 m + 2 m) × 2.4 m = 12 m² × 100 €/m² = 1 200 €
      expect(
        svc.resolveUnitPriceCents(kitchen, {
          width: 300,
          length: 200,
          height: 240,
        }),
      ).toBe(120000);
    });

    it('prices a U-shaped kitchen on all three runs', () => {
      const kitchen: PricingProduct = { ...perSqm, area_formula: 'u_shape' };
      // (2 m + 3 m + 2 m) × 2.5 m = 17.5 m² × 100 €/m² = 1 750 €
      expect(
        svc.resolveUnitPriceCents(kitchen, {
          left: 200,
          back: 300,
          right: 200,
          height: 250,
        }),
      ).toBe(175000);
    });

    it('requires every dimension the formula asks for, naming the missing one', () => {
      const kitchen: PricingProduct = { ...perSqm, area_formula: 'u_shape' };
      expect(() =>
        svc.resolveUnitPriceCents(kitchen, { left: 200, back: 300, height: 250 }),
      ).toThrow(/longueur droite/i);
    });

    it('validates every horizontal dimension against the width bounds', () => {
      // max_width is 400 on the perSqm fixture.
      const kitchen: PricingProduct = { ...perSqm, area_formula: 'l_shape' };
      expect(() =>
        svc.resolveUnitPriceCents(kitchen, {
          width: 300,
          length: 999,
          height: 240,
        }),
      ).toThrow(/longueur/i);
    });

    it('validates the vertical dimension against the height bounds', () => {
      const kitchen: PricingProduct = { ...perSqm, area_formula: 'l_shape' };
      expect(() =>
        svc.resolveUnitPriceCents(kitchen, {
          width: 300,
          length: 200,
          height: 999,
        }),
      ).toThrow(/hauteur/i);
    });

    it('applies the chosen quality tier to a formula price', () => {
      const kitchen: PricingProduct = { ...tiered, area_formula: 'l_shape' };
      // (3 m + 2 m) × 2.4 m = 12 m² × 80 €/m² = 960 €
      expect(
        svc.resolveUnitPriceCents(
          kitchen,
          { width: 300, length: 200, height: 240 },
          'bas',
        ),
      ).toBe(96000);
    });
  });

  // ── Îlot ─────────────────────────────────────────────────────────────────
  // The island is priced on its own measurements, at its own rate, and is
  // independent of the product's gamme.
  describe('îlot', () => {
    const fields = [
      { key: 'lo', label: 'Longueur îlot', unit: 'cm', max: 280, dimensionKey: 'width' as const },
      { key: 'la', label: 'Largeur îlot', unit: 'cm', max: 100, dimensionKey: 'length' as const },
      { key: 'ht', label: 'Hauteur îlot', unit: 'cm' },
    ];
    const perSqmBlock: ConfigBlock = {
      id: 'blk_ilot',
      type: 'ilot',
      label: 'Îlot',
      fields,
      priceMode: 'per_sqm',
      areaFormula: 'width_length',
      pricePerSqmCents: 45000, // 450 €/m²
    };
    const sel = (
      included: boolean,
      measurements: { key: string; label: string; value: number }[],
    ): ConfigSelectionEntry[] => [
      { blockId: 'blk_ilot', type: 'ilot', label: 'Îlot', ilot: { included }, measurements },
    ];
    const full = [
      { key: 'lo', label: 'Longueur îlot', value: 200 },
      { key: 'la', label: 'Largeur îlot', value: 100 },
    ];

    it('bills its own surface at its own rate', () => {
      // 200 × 100 cm = 2 m² × 450 €/m² = 900 €
      const { surchargeCents } = svc.priceConfiguration([perSqmBlock], sel(true, full));
      expect(surchargeCents).toBe(90000);
    });

    it('bills a flat supplement in fixed mode', () => {
      const block: ConfigBlock = {
        ...perSqmBlock,
        priceMode: 'fixed',
        priceCents: 150000, // 1 500 €
      };
      const { surchargeCents } = svc.priceConfiguration([block], sel(true, full));
      expect(surchargeCents).toBe(150000);
    });

    it('bills nothing and keeps no snapshot when the customer declines it', () => {
      const { surchargeCents, snapshot } = svc.priceConfiguration([perSqmBlock], sel(false, full));
      expect(surchargeCents).toBe(0);
      expect(snapshot).toHaveLength(0);
    });

    it('clamps measurements to the field bounds before billing', () => {
      // Longueur clamped 999 → 280 : 280 × 100 cm = 2.8 m² × 450 € = 1 260 €
      const { surchargeCents, snapshot } = svc.priceConfiguration(
        [perSqmBlock],
        sel(true, [{ key: 'lo', label: 'x', value: 999 }, { key: 'la', label: 'x', value: 100 }]),
      );
      expect(surchargeCents).toBe(126000);
      expect(snapshot[0].measurements?.[0].value).toBe(280);
    });

    it('bills nothing while a billed dimension is still missing', () => {
      const { surchargeCents } = svc.priceConfiguration(
        [perSqmBlock],
        sel(true, [{ key: 'lo', label: 'Longueur îlot', value: 200 }]),
      );
      expect(surchargeCents).toBe(0);
    });

    it('ignores untagged measurements', () => {
      // Hauteur îlot has no dimensionKey: recorded, never billed.
      const { surchargeCents, snapshot } = svc.priceConfiguration(
        [perSqmBlock],
        sel(true, [...full, { key: 'ht', label: 'Hauteur îlot', value: 95 }]),
      );
      expect(surchargeCents).toBe(90000);
      expect(snapshot[0].measurements).toHaveLength(3);
    });

    it('does not let the client dictate the island price', () => {
      const tampered: ConfigSelectionEntry[] = [
        {
          blockId: 'blk_ilot',
          type: 'ilot',
          label: 'Îlot',
          ilot: { included: true, surchargeCents: 1 },
          measurements: full,
        },
      ];
      const { surchargeCents, snapshot } = svc.priceConfiguration([perSqmBlock], tampered);
      expect(surchargeCents).toBe(90000);
      expect(snapshot[0].ilot?.surchargeCents).toBe(90000);
    });
  });
});
