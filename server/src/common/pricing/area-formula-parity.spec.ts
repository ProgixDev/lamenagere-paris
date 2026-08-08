/**
 * Client/server parity for per-m² pricing.
 *
 * The customer is quoted by the app ("Calculez votre prix") and charged by the
 * server. Those are two separate implementations of the same maths, so this
 * suite runs both over the same matrix and asserts they agree to the cent.
 * If it ever fails, the app is showing a price the customer won't be charged.
 */
import { PricingService, type PricingProduct } from './pricing.service';
import { AREA_FORMULA_KEYS, type AreaFormulaKey } from './area-formulas';
// The mobile app's own implementation — imported directly, not a copy.
import { computeConfiguredPrice } from '../../../../lib/pricing';
import { dimensionsFromConfigState } from '../../../../lib/config-blocks';
import type { Product } from '../../../../lib/types';

const RATE_EUROS = 100;

const serverProduct = (formula: AreaFormulaKey): PricingProduct => ({
  price_mode: 'per_sqm',
  base_price_cents: null,
  width_coef_cents: null,
  height_coef_cents: null,
  price_per_sqm_cents: RATE_EUROS * 100,
  area_formula: formula,
  ref_width: null,
  ref_height: null,
  min_width: 10,
  min_height: 10,
  max_width: 900,
  max_height: 900,
});

const clientProduct = (formula: AreaFormulaKey): Product =>
  ({
    priceMode: 'per_sqm',
    pricePerSqm: RATE_EUROS,
    areaFormula: formula,
    minDimensions: { width: 10, height: 10 },
    maxDimensions: { width: 900, height: 900 },
  }) as unknown as Product;

/** Dimension sets covering every formula, incl. non-round values. */
const CASES: { dims: Record<string, number>; note: string }[] = [
  { dims: { width: 200, height: 200 }, note: '2m × 2m' },
  { dims: { width: 300, length: 200 }, note: 'tiles 3m × 2m' },
  { dims: { width: 300, length: 200, height: 240 }, note: 'L kitchen' },
  { dims: { left: 200, back: 300, right: 200, height: 250 }, note: 'U kitchen' },
  { dims: { width: 137, length: 219, height: 243 }, note: 'odd values' },
  { dims: { width: 55, length: 55, left: 55, back: 55, right: 55, height: 55 }, note: 'all dims set' },
];

describe('per-m² pricing parity (app vs server)', () => {
  const svc = new PricingService();

  for (const formula of AREA_FORMULA_KEYS) {
    // by_shape takes no typed inputs — its dimensions are derived from the
    // configuration blocks, so it gets its own suite below.
    if (formula === 'by_shape') continue;
    for (const { dims, note } of CASES) {
      const needed = require('./area-formulas').areaFormula(formula).fields;
      const complete = needed.every(
        (f: { key: string }) => dims[f.key] != null,
      );
      if (!complete) continue;

      it(`${formula}: ${note} — app price === server price`, () => {
        const serverCents = svc.resolveUnitPriceCents(
          serverProduct(formula),
          dims,
        );
        const clientEuros = computeConfiguredPrice(clientProduct(formula), dims);

        expect(clientEuros).toBeDefined();
        expect(clientEuros! * 100).toBe(serverCents);
      });
    }
  }

  it('the app shows no price until every billed dimension is entered', () => {
    // U-shape missing its right-hand run.
    expect(
      computeConfiguredPrice(clientProduct('u_shape'), {
        left: 200,
        back: 300,
        height: 250,
      }),
    ).toBeUndefined();
  });

  // ── Shape-driven kitchens (the real "Cuisines" setup) ───────────────────
  describe('by_shape (cuisine I / L / U)', () => {
    const svc2 = new PricingService();
    // Mirrors the live Cuisines category: measurement fields tagged with the
    // role they play, and shape options declaring how many pans they bill.
    const blocks: any[] = [
      {
        id: 'blk_mes',
        type: 'measurements',
        label: 'Mesures de la cuisine',
        fields: [
          { key: 'f_hm', label: 'Hauteur mur', priceRole: 'height' },
          { key: 'f_lo', label: 'Longueur', priceRole: 'run1' },
          { key: 'f_la', label: 'Largeur', priceRole: 'run2' },
          { key: 'f_l2', label: 'Deuxième largeur si U', priceRole: 'run3' },
          { key: 'f_hp', label: 'Hauteur plan de travail' }, // untagged
        ],
      },
      {
        id: 'blk_forme',
        type: 'shape',
        label: 'Forme de la cuisine',
        options: [
          { key: 'i', label: 'I', runs: 1 },
          { key: 'l', label: 'L', runs: 2 },
          { key: 'u', label: 'U', runs: 3 },
        ],
      },
    ];

    const selection = (shape: string) => [
      {
        blockId: 'blk_mes',
        type: 'measurements' as const,
        label: 'Mesures',
        measurements: [
          { key: 'f_hm', label: 'Hauteur mur', value: 240 },
          { key: 'f_lo', label: 'Longueur', value: 300 },
          { key: 'f_la', label: 'Largeur', value: 200 },
          { key: 'f_l2', label: '2e largeur', value: 150 },
          { key: 'f_hp', label: 'Plan', value: 90 },
        ],
      },
      {
        blockId: 'blk_forme',
        type: 'shape' as const,
        label: 'Forme',
        shape: { key: shape, label: shape.toUpperCase() },
      },
    ];

    const kitchen: PricingProduct = {
      ...serverProduct('by_shape'),
      min_width: null,
      max_width: null,
      min_height: null,
      max_height: null,
    };

    const price = (shape: string) =>
      svc2.resolveUnitPriceCents(
        kitchen,
        svc2.dimensionsFromSelection(blocks as never, selection(shape) as never),
      );

    it('I bills one pan: 300 × 240 = 7.20 m² = 720 €', () => {
      expect(price('i')).toBe(72000);
    });

    it('L bills two pans: (300 + 200) × 240 = 12.00 m² = 1 200 €', () => {
      expect(price('l')).toBe(120000);
    });

    it('U bills three pans: (300 + 200 + 150) × 240 = 15.60 m² = 1 560 €', () => {
      expect(price('u')).toBe(156000);
    });

    it('ignores untagged measurements (hauteur plan de travail)', () => {
      // Changing the worktop height must not move the price.
      const withDifferentWorktop = selection('l').map((e) =>
        e.blockId === 'blk_mes'
          ? {
              ...e,
              measurements: e.measurements!.map((m) =>
                m.key === 'f_hp' ? { ...m, value: 200 } : m,
              ),
            }
          : e,
      );
      expect(
        svc2.resolveUnitPriceCents(
          kitchen,
          svc2.dimensionsFromSelection(
            blocks as never,
            withDifferentWorktop as never,
          ),
        ),
      ).toBe(120000);
    });

    it.each([
      ['i', 720],
      ['l', 1200],
      ['u', 1560],
    ])(
      'shape %s: the app derives the same price as the server (%i €)',
      (shape, expectedEuros) => {
        // The app works from raw text inputs keyed by block, the server from
        // the submitted selection. Both must land on the same number.
        const configState = {
          blk_mes: {
            measurements: {
              f_hm: '240',
              f_lo: '300',
              f_la: '200',
              f_l2: '150',
              f_hp: '90',
            },
          },
          blk_forme: { shapeKey: shape },
        };
        const appDims = dimensionsFromConfigState(
          blocks as never,
          configState as never,
        );
        const appEuros = computeConfiguredPrice(
          clientProduct('by_shape'),
          appDims,
        );

        expect(appEuros).toBe(expectedEuros);
        expect(appEuros! * 100).toBe(price(shape as string));
      },
    );

    it('takes pan roles from the blocks, not from the client payload', () => {
      // A tampered selection claiming an unknown field cannot add a pan.
      const tampered = [
        {
          ...selection('i')[0],
          measurements: [
            ...selection('i')[0].measurements!,
            { key: 'f_injected', label: 'Pirate', value: 9999 },
          ],
        },
        selection('i')[1],
      ];
      expect(
        svc2.resolveUnitPriceCents(
          kitchen,
          svc2.dimensionsFromSelection(blocks as never, tampered as never),
        ),
      ).toBe(72000);
    });
  });

  it('the app ignores dimensions the formula does not bill', () => {
    const withNoise = computeConfiguredPrice(clientProduct('width_length'), {
      width: 300,
      length: 200,
      height: 999,
    });
    const without = computeConfiguredPrice(clientProduct('width_length'), {
      width: 300,
      length: 200,
    });
    expect(withNoise).toBe(without);
    expect(withNoise).toBe(600); // 3m × 2m × 100 €/m²
  });
});
