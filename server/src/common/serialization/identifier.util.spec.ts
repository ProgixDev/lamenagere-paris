import { identifierColumn, isUuid } from './identifier.util';

describe('identifier.util', () => {
  it('recognises the ids this database actually produces', () => {
    // Real rows from `products` and `categories`, which are gen_random_uuid().
    for (const id of [
      '3f8a1c2e-9b4d-4f7a-8e21-0c5d6b7a8f90',
      '00000000-0000-0000-0000-000000000000',
      'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF',
    ]) {
      expect(isUuid(id)).toBe(true);
      expect(identifierColumn(id)).toBe('id');
    }
  });

  it('treats every catalogue slug as a slug', () => {
    // Les dix rubriques réelles, plus des formes de slug produit.
    for (const slug of [
      'cuisines',
      'portes',
      'baies-vitrees',
      'canapes-fauteuils',
      'tables-manger',
      'chambres',
      'carrelage',
      'electromenager',
      'decoration',
      'lessive-entretien',
      'plan-de-travail-chene-massif',
      'porte-dentree-blindee-3-points',
    ]) {
      expect(isUuid(slug)).toBe(false);
      expect(identifierColumn(slug)).toBe('slug');
    }
  });

  it('rejects near-misses rather than sending them to the id column', () => {
    // Chacune casse sur un point precis : longueur, separateur, caractere hors
    // hexadecimal, espace. Une version relachee de la regex en laisserait
    // passer, et la ligne serait alors cherchee dans la mauvaise colonne — ou
    // elle ne serait jamais trouvee, donc 404 sur un produit qui existe.
    for (const value of [
      '3f8a1c2e-9b4d-4f7a-8e21-0c5d6b7a8f9', // 11 chars au dernier groupe
      '3f8a1c2e-9b4d-4f7a-8e21-0c5d6b7a8f901', // 13
      '3f8a1c2e9b4d4f7a8e210c5d6b7a8f90', // sans tirets
      '3f8a1c2e-9b4d-4f7a-8e21_0c5d6b7a8f90', // underscore
      'zf8a1c2e-9b4d-4f7a-8e21-0c5d6b7a8f90', // 'z' n'est pas hexadecimal
      ' 3f8a1c2e-9b4d-4f7a-8e21-0c5d6b7a8f90', // espace de tete
      '',
    ]) {
      expect(isUuid(value)).toBe(false);
    }
  });

  it('never confuses the two sets', () => {
    // Un slug ne peut pas etre a la fois de l'hexadecimal pur et ponctue aux
    // bonnes places : c'est ce qui rend la cohabitation des deux adressages
    // sure, et non une convention qu'il faudrait respecter a la main.
    const slugQuiRessemble = 'abcdefab-abcd-abcd-abcd-abcdefabcdef';
    // Celui-la EST un UUID valide — et c'est correct : aucune rubrique ne
    // pourrait porter ce nom.
    expect(isUuid(slugQuiRessemble)).toBe(true);
  });
});
