import { BadRequestException } from '@nestjs/common';
import { PricingService, PricingProduct } from './pricing.service';

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

  it('adds the chosen opening-type surcharge on top of the dimension price', () => {
    const withTypes: PricingProduct = {
      ...perSqm,
      opening_types: [
        { type: 'fixe', surcharge_cents: 0 },
        { type: 'coulissante', surcharge_cents: 15000 }, // +150 €
      ],
    };
    // 400 € base + 150 € surcharge = 550 €
    expect(
      svc.resolveUnitPriceCents(withTypes, { width: 200, height: 200 }, 'coulissante'),
    ).toBe(55000);
  });

  it('requires an opening type when the product offers them', () => {
    const withTypes: PricingProduct = {
      ...perSqm,
      opening_types: [{ type: 'fixe', surcharge_cents: 0 }],
    };
    expect(() =>
      svc.resolveUnitPriceCents(withTypes, { width: 200, height: 200 }),
    ).toThrow(BadRequestException);
  });

  it('rejects an unknown opening type', () => {
    const withTypes: PricingProduct = {
      ...perSqm,
      opening_types: [{ type: 'fixe', surcharge_cents: 0 }],
    };
    expect(() =>
      svc.resolveUnitPriceCents(withTypes, { width: 200, height: 200 }, 'bogus'),
    ).toThrow(BadRequestException);
  });
});
