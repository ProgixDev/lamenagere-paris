import {
  centsToEuros,
  eurosToCents,
  formatEUR,
  formatEURFromCents,
} from './money.util';

describe('money.util', () => {
  it('converts between cents and euros', () => {
    expect(centsToEuros(289000)).toBe(2890);
    expect(eurosToCents(2890)).toBe(289000);
  });

  it('formats euros with NNBSP grouping and € suffix', () => {
    const s = formatEUR(2890);
    expect(s.endsWith('€')).toBe(true);
    expect(s.replace(/[  \s]/g, '')).toBe('2890€');
  });

  it('formats from cents with no decimals', () => {
    expect(formatEURFromCents(446100).replace(/[  \s]/g, '')).toBe(
      '4461€',
    );
  });
});
