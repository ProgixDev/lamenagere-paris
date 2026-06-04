import { BadRequestException } from '@nestjs/common';
import { PricingService, PricingProduct } from './pricing.service';

const calculated: PricingProduct = {
  price_mode: 'calculated',
  base_price_cents: 385000, // 3 850 €
  width_coef_cents: 850, //  8,50 €/cm
  height_coef_cents: 620, // 6,20 €/cm
  ref_width: 200,
  ref_height: 220,
  min_width: 80,
  min_height: 80,
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
});
