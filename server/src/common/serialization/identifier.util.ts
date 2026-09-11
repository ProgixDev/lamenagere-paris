/**
 * Telling a UUID apart from a slug.
 *
 * ── Pourquoi le catalogue en a besoin ───────────────────────────────────────
 * L'application mobile adresse les produits et les rubriques par UUID, parce
 * qu'elle les a toujours reçus d'une liste qu'elle vient de charger. La
 * boutique web ne peut pas : ses URL sont `/boutique/cuisines` et
 * `/boutique/p/plan-de-travail-chene`, servies statiquement et indexées par
 * Google. Une URL de catalogue contenant un UUID est illisible, impossible à
 * partager et sans valeur pour le référencement — et c'est ce que le référencement
 * finance ici.
 *
 * Les deux tables portent déjà `slug text NOT NULL UNIQUE` (migration
 * `0002_catalog.sql`), donc un slug désigne exactement une ligne : les deux
 * formes d'adressage cohabitent sans ambiguïté.
 */

/**
 * Canonical 8-4-4-4-12 hex form, which is what `gen_random_uuid()` produces and
 * therefore the only shape an id from this database can take.
 *
 * Le test est délibérément strict plutôt que « ça ressemble à un UUID » : un
 * slug ne peut pas contenir de tiret aux bonnes places **et** n'être que de
 * l'hexadécimal, donc les deux ensembles ne se recouvrent pas. Une version
 * relâchée classerait un slug exotique comme un identifiant et le ferait
 * chercher dans la mauvaise colonne, où il ne serait jamais trouvé.
 */
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/**
 * Which column a public `:id` path parameter should be matched against.
 *
 * Retourner le nom de la colonne plutôt qu'un booléen fait lire l'appelant
 * comme la requête qu'il construit : `.eq(identifierColumn(param), param)`.
 */
export function identifierColumn(value: string): 'id' | 'slug' {
  return isUuid(value) ? 'id' : 'slug';
}
