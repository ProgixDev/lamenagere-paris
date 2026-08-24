import {
  VAT_RATE_BP_METROPOLE,
  VAT_RATE_BP_OUTREMER,
  vatCentsFor,
  vatExemptionNoteFor,
  vatRateBpForPostalCode,
} from './vat';

describe('vat', () => {
  it('charges the standard rate across the VAT territory', () => {
    for (const code of ['75001', '13008', '69003', '33000']) {
      expect(vatRateBpForPostalCode(code)).toBe(VAT_RATE_BP_METROPOLE);
    }
  });

  it('keeps Corsica and Monaco inside the VAT territory', () => {
    // Corsica has reduced rates on some goods but is not exempt, and Monaco's
    // 980xx codes must not be swept up by the 98 = outre-mer prefix.
    expect(vatRateBpForPostalCode('20000')).toBe(VAT_RATE_BP_METROPOLE);
    expect(vatRateBpForPostalCode('20200')).toBe(VAT_RATE_BP_METROPOLE);
    expect(vatRateBpForPostalCode('98000')).toBe(VAT_RATE_BP_METROPOLE);
  });

  it('exempts every overseas territory', () => {
    const overseas = [
      '97110', // Guadeloupe
      '97200', // Martinique
      '97300', // Guyane
      '97400', // La Réunion
      '97600', // Mayotte
      '97500', // Saint-Pierre-et-Miquelon
      '97133', // Saint-Barthélemy
      '97150', // Saint-Martin
      '98600', // Wallis-et-Futuna
      '98700', // Polynésie française
      '98800', // Nouvelle-Calédonie
    ];
    for (const code of overseas) {
      expect(vatRateBpForPostalCode(code)).toBe(VAT_RATE_BP_OUTREMER);
    }
  });

  it('reads postal codes typed with spaces or separators', () => {
    expect(vatRateBpForPostalCode('97 400')).toBe(VAT_RATE_BP_OUTREMER);
    expect(vatRateBpForPostalCode('75-001')).toBe(VAT_RATE_BP_METROPOLE);
  });

  it('falls back to the standard rate on unusable input', () => {
    // Over-charging is refundable; under-charging is money out of our pocket.
    for (const code of ['', '   ', 'abcde', null, undefined]) {
      expect(vatRateBpForPostalCode(code)).toBe(VAT_RATE_BP_METROPOLE);
    }
  });

  it('rounds VAT to the cent', () => {
    expect(vatCentsFor(399000, VAT_RATE_BP_METROPOLE)).toBe(79800);
    expect(vatCentsFor(123456, VAT_RATE_BP_METROPOLE)).toBe(24691);
    expect(vatCentsFor(123456, VAT_RATE_BP_OUTREMER)).toBe(0);
    expect(vatCentsFor(0, VAT_RATE_BP_METROPOLE)).toBe(0);
  });

  it('attaches the legal mention only to exempt orders', () => {
    expect(vatExemptionNoteFor(VAT_RATE_BP_METROPOLE)).toBeNull();
    expect(vatExemptionNoteFor(VAT_RATE_BP_OUTREMER)).toContain('294 du CGI');
  });
});
