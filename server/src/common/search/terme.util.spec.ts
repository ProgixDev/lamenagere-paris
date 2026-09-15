import { normaliserTerme, tsqueryPrefixe } from './terme.util';

/**
 * Ces cas ne testent pas une fonction, ils testent un **accord** : celui entre
 * `normaliserTerme` et `public.f_unaccent` (migration 0048). Si l'un des deux
 * change, l'index cesse de répondre au terme cherché, et rien d'autre ne le
 * signalerait — la recherche rendrait simplement zéro résultat, comme avant
 * 0048.
 */
describe('normaliserTerme', () => {
  it('désaccentue ce que le client tape avec accents', () => {
    // Le cas qui a motivé la migration : 'baie vitrée' rendait 14 produits,
    // 'baie vitree' en rendait zéro.
    expect(normaliserTerme('baie vitrée')).toBe('baie vitree');
    expect(normaliserTerme('Électroménager')).toBe('Electromenager');
    expect(normaliserTerme('façade')).toBe('facade');
    expect(normaliserTerme('chêne massif')).toBe('chene massif');
    expect(normaliserTerme('à côté')).toBe('a cote');
  });

  it('laisse intact un terme déjà sans accent', () => {
    expect(normaliserTerme('baie vitree')).toBe('baie vitree');
    expect(normaliserTerme('cuisine')).toBe('cuisine');
  });

  it('translittère les ligatures, que NFD ne décompose pas', () => {
    // Sans le pré-passage, celles-ci traverseraient intactes et ne
    // correspondraient pas à ce que `unaccent` a stocké dans l'index.
    expect(normaliserTerme('cœur')).toBe('coeur');
    expect(normaliserTerme('nœud')).toBe('noeud');
    expect(normaliserTerme('ex æquo')).toBe('ex aequo');
  });

  it('ne met pas en minuscules : to_tsvector s’en charge', () => {
    expect(normaliserTerme('CUISINE')).toBe('CUISINE');
  });

  it('comprime les espaces et rogne les bords', () => {
    expect(normaliserTerme('  baie   vitrée  ')).toBe('baie vitree');
    expect(normaliserTerme('porte\tchêne')).toBe('porte chene');
  });

  it('tronque à 120 caractères', () => {
    expect(normaliserTerme('a'.repeat(300))).toHaveLength(120);
  });

  it('rend une chaîne vide pour une saisie vide ou blanche', () => {
    expect(normaliserTerme('')).toBe('');
    expect(normaliserTerme('   ')).toBe('');
  });
});

describe('tsqueryPrefixe', () => {
  it('met une étoile sur le dernier mot, et seulement lui', () => {
    // C'est toute la raison d'être de la fonction : sur la base de production,
    // websearch_to_tsquery('french','cuis') rend 0 produit, to_tsquery(
    // 'french','cuis:*') en rend 59. Sans préfixe le panneau reste vide jusqu'à
    // ce que le mot soit fini, c'est-à-dire jusqu'à ce qu'il ne serve plus.
    expect(tsqueryPrefixe('cuis')).toBe('cuis:*');
    expect(tsqueryPrefixe('baie vitr')).toBe('baie & vitr:*');
  });

  it('désaccentue comme le reste', () => {
    expect(tsqueryPrefixe('baie vitrée')).toBe('baie & vitree:*');
  });

  it('met en minuscules — to_tsquery ne le fait pas pour les préfixes', () => {
    expect(tsqueryPrefixe('CUIS')).toBe('cuis:*');
  });

  it('jette tout ce qui n’est pas lettre ou chiffre', () => {
    // `to_tsquery` ANALYSE une syntaxe (&, |, !, <->, parenthèses) et lève sur
    // une entrée mal formée, contrairement à websearch_to_tsquery qui pardonne
    // tout. Une parenthèse tapée par le client ferait une 500.
    expect(tsqueryPrefixe('cuisine (chêne)')).toBe('cuisine & chene:*');
    expect(tsqueryPrefixe("porte d'entrée")).toBe('porte & d & entree:*');
    expect(tsqueryPrefixe('a & b | c ! d')).toBe('a & b & c & d:*');
    expect(tsqueryPrefixe('!!! ((( ')).toBeNull();
  });

  it('garde les chiffres, qui sont dans les références produit', () => {
    expect(tsqueryPrefixe('serie A970')).toBe('serie & a970:*');
  });

  it('borne le nombre de mots', () => {
    const requete = tsqueryPrefixe('un deux trois quatre cinq six sept huit neuf dix');
    expect(requete?.split(' & ')).toHaveLength(8);
  });

  it('rend null quand il ne reste rien d’interrogeable', () => {
    // L'appelant ne doit alors pas interroger la base : une tsquery vide ne
    // correspond à aucune ligne, ce qui se lirait « aucun résultat » au lieu de
    // « rien demandé ».
    expect(tsqueryPrefixe('')).toBeNull();
    expect(tsqueryPrefixe('   ')).toBeNull();
    expect(tsqueryPrefixe('###')).toBeNull();
  });
});
