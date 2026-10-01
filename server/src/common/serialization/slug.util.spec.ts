import { nextFreeSlug, slugify } from './slug.util';

describe('slugify', () => {
  it.each([
    ['VENDÔME', 'vendome'],
    ['Porte SL200 ÉLÉGANCE', 'porte-sl200-elegance'],
    ['ÉLYSÉE N°1', 'elysee-n-1'],
    ['  Cuisine   Œuvre  ', 'cuisine-oeuvre'],
    ['Prix :14€/M2, Carrelage', 'prix-14-m2-carrelage'],
    ['déjà-propre', 'deja-propre'],
  ])('%s → %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('returns an empty string when nothing usable is left', () => {
    expect(slugify('€ — ©')).toBe('');
  });
});

describe('nextFreeSlug', () => {
  it('keeps the base when free', () => {
    expect(nextFreeSlug('harmonie', new Set())).toBe('harmonie');
  });

  it('suffixes past taken slugs', () => {
    expect(
      nextFreeSlug('harmonie', new Set(['harmonie', 'harmonie-2'])),
    ).toBe('harmonie-3');
  });

  it('avoids reserved slugs', () => {
    expect(nextFreeSlug('panier', new Set(), new Set(['panier']))).toBe(
      'panier-2',
    );
  });

  it('never returns a UUID-shaped slug', () => {
    const uuid = '0e4a1c2b-1111-4222-8333-944455556666';
    expect(nextFreeSlug(uuid, new Set())).toBe(`${uuid}-2`);
  });
});
