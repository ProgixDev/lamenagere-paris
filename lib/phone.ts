/** ISO 3166-1 alpha-2 country code, e.g. "FR". */
export type PhoneCountryCode = string;

export interface PhoneCountry {
  code: PhoneCountryCode;
  label: string;
  dialCode: string;
  flag: string;
  /** Lowercased, accent-free haystack used by the picker search. */
  search: string;
}

/** Turn "FR" into 🇫🇷 using the regional-indicator code points. */
export function flagFor(code: string): string {
  return code
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

function normalise(value: string): string {
  const lower = value.toLowerCase();
  // Hermes may not ship String.prototype.normalize; fall back to the raw value.
  return typeof lower.normalize === "function"
    ? lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    : lower;
}

/** [ISO code, French name, dial code] for every country / territory. */
const RAW: [string, string, string][] = [
  ["AF", "Afghanistan", "+93"],
  ["ZA", "Afrique du Sud", "+27"],
  ["AL", "Albanie", "+355"],
  ["DZ", "Algérie", "+213"],
  ["DE", "Allemagne", "+49"],
  ["AD", "Andorre", "+376"],
  ["AO", "Angola", "+244"],
  ["AI", "Anguilla", "+1264"],
  ["AG", "Antigua-et-Barbuda", "+1268"],
  ["SA", "Arabie saoudite", "+966"],
  ["AR", "Argentine", "+54"],
  ["AM", "Arménie", "+374"],
  ["AW", "Aruba", "+297"],
  ["AU", "Australie", "+61"],
  ["AT", "Autriche", "+43"],
  ["AZ", "Azerbaïdjan", "+994"],
  ["BS", "Bahamas", "+1242"],
  ["BH", "Bahreïn", "+973"],
  ["BD", "Bangladesh", "+880"],
  ["BB", "Barbade", "+1246"],
  ["BE", "Belgique", "+32"],
  ["BZ", "Belize", "+501"],
  ["BJ", "Bénin", "+229"],
  ["BM", "Bermudes", "+1441"],
  ["BT", "Bhoutan", "+975"],
  ["BY", "Biélorussie", "+375"],
  ["MM", "Birmanie", "+95"],
  ["BO", "Bolivie", "+591"],
  ["BA", "Bosnie-Herzégovine", "+387"],
  ["BW", "Botswana", "+267"],
  ["BR", "Brésil", "+55"],
  ["BN", "Brunei", "+673"],
  ["BG", "Bulgarie", "+359"],
  ["BF", "Burkina Faso", "+226"],
  ["BI", "Burundi", "+257"],
  ["KH", "Cambodge", "+855"],
  ["CM", "Cameroun", "+237"],
  ["CA", "Canada", "+1"],
  ["CV", "Cap-Vert", "+238"],
  ["CL", "Chili", "+56"],
  ["CN", "Chine", "+86"],
  ["CY", "Chypre", "+357"],
  ["CO", "Colombie", "+57"],
  ["KM", "Comores", "+269"],
  ["CG", "Congo-Brazzaville", "+242"],
  ["CD", "Congo-Kinshasa", "+243"],
  ["KP", "Corée du Nord", "+850"],
  ["KR", "Corée du Sud", "+82"],
  ["CR", "Costa Rica", "+506"],
  ["CI", "Côte d'Ivoire", "+225"],
  ["HR", "Croatie", "+385"],
  ["CU", "Cuba", "+53"],
  ["CW", "Curaçao", "+599"],
  ["DK", "Danemark", "+45"],
  ["DJ", "Djibouti", "+253"],
  ["DM", "Dominique", "+1767"],
  ["EG", "Égypte", "+20"],
  ["AE", "Émirats arabes unis", "+971"],
  ["EC", "Équateur", "+593"],
  ["ER", "Érythrée", "+291"],
  ["ES", "Espagne", "+34"],
  ["EE", "Estonie", "+372"],
  ["SZ", "Eswatini", "+268"],
  ["US", "États-Unis", "+1"],
  ["ET", "Éthiopie", "+251"],
  ["FJ", "Fidji", "+679"],
  ["FI", "Finlande", "+358"],
  ["FR", "France", "+33"],
  ["GA", "Gabon", "+241"],
  ["GM", "Gambie", "+220"],
  ["GE", "Géorgie", "+995"],
  ["GH", "Ghana", "+233"],
  ["GI", "Gibraltar", "+350"],
  ["GR", "Grèce", "+30"],
  ["GD", "Grenade", "+1473"],
  ["GL", "Groenland", "+299"],
  ["GP", "Guadeloupe", "+590"],
  ["GU", "Guam", "+1671"],
  ["GT", "Guatemala", "+502"],
  ["GG", "Guernesey", "+44"],
  ["GN", "Guinée", "+224"],
  ["GQ", "Guinée équatoriale", "+240"],
  ["GW", "Guinée-Bissau", "+245"],
  ["GY", "Guyana", "+592"],
  ["GF", "Guyane française", "+594"],
  ["HT", "Haïti", "+509"],
  ["HN", "Honduras", "+504"],
  ["HK", "Hong Kong", "+852"],
  ["HU", "Hongrie", "+36"],
  ["IM", "Île de Man", "+44"],
  ["KY", "Îles Caïmans", "+1345"],
  ["CK", "Îles Cook", "+682"],
  ["FO", "Îles Féroé", "+298"],
  ["FK", "Îles Malouines", "+500"],
  ["MH", "Îles Marshall", "+692"],
  ["SB", "Îles Salomon", "+677"],
  ["TC", "Îles Turques-et-Caïques", "+1649"],
  ["VI", "Îles Vierges américaines", "+1340"],
  ["VG", "Îles Vierges britanniques", "+1284"],
  ["IN", "Inde", "+91"],
  ["ID", "Indonésie", "+62"],
  ["IQ", "Irak", "+964"],
  ["IR", "Iran", "+98"],
  ["IE", "Irlande", "+353"],
  ["IS", "Islande", "+354"],
  ["IL", "Israël", "+972"],
  ["IT", "Italie", "+39"],
  ["JM", "Jamaïque", "+1876"],
  ["JP", "Japon", "+81"],
  ["JE", "Jersey", "+44"],
  ["JO", "Jordanie", "+962"],
  ["KZ", "Kazakhstan", "+7"],
  ["KE", "Kenya", "+254"],
  ["KG", "Kirghizistan", "+996"],
  ["KI", "Kiribati", "+686"],
  ["XK", "Kosovo", "+383"],
  ["KW", "Koweït", "+965"],
  ["RE", "La Réunion", "+262"],
  ["LA", "Laos", "+856"],
  ["LS", "Lesotho", "+266"],
  ["LV", "Lettonie", "+371"],
  ["LB", "Liban", "+961"],
  ["LR", "Liberia", "+231"],
  ["LY", "Libye", "+218"],
  ["LI", "Liechtenstein", "+423"],
  ["LT", "Lituanie", "+370"],
  ["LU", "Luxembourg", "+352"],
  ["MO", "Macao", "+853"],
  ["MK", "Macédoine du Nord", "+389"],
  ["MG", "Madagascar", "+261"],
  ["MY", "Malaisie", "+60"],
  ["MW", "Malawi", "+265"],
  ["MV", "Maldives", "+960"],
  ["ML", "Mali", "+223"],
  ["MT", "Malte", "+356"],
  ["MA", "Maroc", "+212"],
  ["MQ", "Martinique", "+596"],
  ["MU", "Maurice", "+230"],
  ["MR", "Mauritanie", "+222"],
  ["YT", "Mayotte", "+262"],
  ["MX", "Mexique", "+52"],
  ["FM", "Micronésie", "+691"],
  ["MD", "Moldavie", "+373"],
  ["MC", "Monaco", "+377"],
  ["MN", "Mongolie", "+976"],
  ["ME", "Monténégro", "+382"],
  ["MS", "Montserrat", "+1664"],
  ["MZ", "Mozambique", "+258"],
  ["NA", "Namibie", "+264"],
  ["NR", "Nauru", "+674"],
  ["NP", "Népal", "+977"],
  ["NI", "Nicaragua", "+505"],
  ["NE", "Niger", "+227"],
  ["NG", "Nigeria", "+234"],
  ["NU", "Niue", "+683"],
  ["NO", "Norvège", "+47"],
  ["NC", "Nouvelle-Calédonie", "+687"],
  ["NZ", "Nouvelle-Zélande", "+64"],
  ["OM", "Oman", "+968"],
  ["UG", "Ouganda", "+256"],
  ["UZ", "Ouzbékistan", "+998"],
  ["PK", "Pakistan", "+92"],
  ["PW", "Palaos", "+680"],
  ["PS", "Palestine", "+970"],
  ["PA", "Panama", "+507"],
  ["PG", "Papouasie-Nouvelle-Guinée", "+675"],
  ["PY", "Paraguay", "+595"],
  ["NL", "Pays-Bas", "+31"],
  ["PE", "Pérou", "+51"],
  ["PH", "Philippines", "+63"],
  ["PL", "Pologne", "+48"],
  ["PF", "Polynésie française", "+689"],
  ["PR", "Porto Rico", "+1787"],
  ["PT", "Portugal", "+351"],
  ["QA", "Qatar", "+974"],
  ["CF", "République centrafricaine", "+236"],
  ["DO", "République dominicaine", "+1809"],
  ["CZ", "République tchèque", "+420"],
  ["RO", "Roumanie", "+40"],
  ["GB", "Royaume-Uni", "+44"],
  ["RU", "Russie", "+7"],
  ["RW", "Rwanda", "+250"],
  ["EH", "Sahara occidental", "+212"],
  ["BL", "Saint-Barthélemy", "+590"],
  ["KN", "Saint-Kitts-et-Nevis", "+1869"],
  ["SM", "Saint-Marin", "+378"],
  ["MF", "Saint-Martin", "+590"],
  ["PM", "Saint-Pierre-et-Miquelon", "+508"],
  ["VC", "Saint-Vincent-et-les-Grenadines", "+1784"],
  ["LC", "Sainte-Lucie", "+1758"],
  ["SV", "Salvador", "+503"],
  ["WS", "Samoa", "+685"],
  ["AS", "Samoa américaines", "+1684"],
  ["ST", "São Tomé-et-Principe", "+239"],
  ["SN", "Sénégal", "+221"],
  ["RS", "Serbie", "+381"],
  ["SC", "Seychelles", "+248"],
  ["SL", "Sierra Leone", "+232"],
  ["SG", "Singapour", "+65"],
  ["SK", "Slovaquie", "+421"],
  ["SI", "Slovénie", "+386"],
  ["SO", "Somalie", "+252"],
  ["SD", "Soudan", "+249"],
  ["SS", "Soudan du Sud", "+211"],
  ["LK", "Sri Lanka", "+94"],
  ["SE", "Suède", "+46"],
  ["CH", "Suisse", "+41"],
  ["SR", "Suriname", "+597"],
  ["SY", "Syrie", "+963"],
  ["TJ", "Tadjikistan", "+992"],
  ["TW", "Taïwan", "+886"],
  ["TZ", "Tanzanie", "+255"],
  ["TD", "Tchad", "+235"],
  ["TH", "Thaïlande", "+66"],
  ["TL", "Timor oriental", "+670"],
  ["TG", "Togo", "+228"],
  ["TO", "Tonga", "+676"],
  ["TT", "Trinité-et-Tobago", "+1868"],
  ["TN", "Tunisie", "+216"],
  ["TM", "Turkménistan", "+993"],
  ["TR", "Turquie", "+90"],
  ["TV", "Tuvalu", "+688"],
  ["UA", "Ukraine", "+380"],
  ["UY", "Uruguay", "+598"],
  ["VU", "Vanuatu", "+678"],
  ["VA", "Vatican", "+379"],
  ["VE", "Venezuela", "+58"],
  ["VN", "Viêt Nam", "+84"],
  ["WF", "Wallis-et-Futuna", "+681"],
  ["YE", "Yémen", "+967"],
  ["ZM", "Zambie", "+260"],
  ["ZW", "Zimbabwe", "+263"],
];

/** Every country offered in the phone field, sorted by French name. */
export const PHONE_COUNTRIES: PhoneCountry[] = RAW.map(
  ([code, label, dialCode]) => ({
    code,
    label,
    dialCode,
    flag: flagFor(code),
    search: `${normalise(label)} ${code.toLowerCase()} ${dialCode}`,
  }),
).sort((a, b) => a.label.localeCompare(b.label, "fr"));

/** Shown first in the picker — the markets we serve most. */
export const SUGGESTED_PHONE_COUNTRIES: PhoneCountryCode[] = [
  "FR",
  "SN",
  "BE",
  "CH",
  "CA",
  "MA",
  "CI",
];

export const DEFAULT_PHONE_COUNTRY: PhoneCountryCode = "FR";

export function findPhoneCountry(code: string): PhoneCountry | undefined {
  return PHONE_COUNTRIES.find((c) => c.code === code);
}

export function isPhoneCountryCode(code: string): boolean {
  return findPhoneCountry(code) !== undefined;
}

export function dialCodeFor(code: string): string {
  return findPhoneCountry(code)?.dialCode ?? "+33";
}

/** Case/accent-insensitive match on name, ISO code or dial code. */
export function searchPhoneCountries(query: string): PhoneCountry[] {
  const q = normalise(query.trim());
  if (!q) return PHONE_COUNTRIES;
  return PHONE_COUNTRIES.filter((c) => c.search.includes(q));
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
