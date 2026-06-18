export type PhoneCountryCode = "FR" | "SN";

export interface PhoneCountry {
  code: PhoneCountryCode;
  label: string;
  dialCode: string;
  flag: string;
}

/** Countries offered in the signup phone field. */
export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "FR", label: "France", dialCode: "+33", flag: "🇫🇷" },
  { code: "SN", label: "Sénégal", dialCode: "+221", flag: "🇸🇳" },
];

export const DEFAULT_PHONE_COUNTRY: PhoneCountryCode = "FR";

export function dialCodeFor(code: string): string {
  return PHONE_COUNTRIES.find((c) => c.code === code)?.dialCode ?? "+33";
}

/** Local number is valid once it has at least 6 digits. */
export function isValidLocalNumber(local: string): boolean {
  return local.replace(/\D/g, "").length >= 6;
}

/**
 * Combine a country selection + local number into a single stored string,
 * e.g. ("FR", "06 12 34 56 78") -> "+33612345678". The national trunk "0"
 * is dropped before prefixing the dial code.
 */
export function combinePhone(countryCode: string, local: string): string {
  const digits = local.replace(/\D/g, "").replace(/^0+/, "");
  return `${dialCodeFor(countryCode)}${digits}`;
}
