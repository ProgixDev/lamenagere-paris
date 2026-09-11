import { euroQueryToCents, parseFilters } from './catalog-filters.util';

describe('catalog filters', () => {
  it('is empty when the client asks for nothing', () => {
    // Le cas de l'application mobile, qui n'envoie aucun de ces parametres :
    // le resultat doit etre rigoureusement vide pour que le service retombe
    // sur son tri par popularite d'origine.
    expect(parseFilters({})).toEqual({});
  });

  describe('sort', () => {
    it('accepts the four supported orders', () => {
      for (const sort of ['popular', 'recent', 'price_asc', 'price_desc']) {
        expect(parseFilters({ sort }).sort).toBe(sort);
      }
    });

    it('ignores an unknown order instead of failing the request', () => {
      // Une page de catalogue est indexee : un `?sort=` herite d'une ancienne
      // version, ou bricole a la main, doit rendre le catalogue par defaut et
      // non une 400 vue par Google.
      for (const sort of ['prix-croissant', 'PRICE_ASC', 'popularity', '']) {
        expect(parseFilters({ sort }).sort).toBeUndefined();
      }
    });
  });

  describe('prix', () => {
    it('convertit les euros du client en centimes du serveur', () => {
      expect(parseFilters({ priceMin: '100' }).priceMinCents).toBe(10000);
      expect(parseFilters({ priceMax: '2500.5' }).priceMaxCents).toBe(250050);
    });

    it('arrondit au centime sans laisser trainer un flottant', () => {
      // 19.99 * 100 vaut 1998.9999... en binaire.
      expect(parseFilters({ priceMin: '19.99' }).priceMinCents).toBe(1999);
    });

    it('remet des bornes inversees dans l ordre', () => {
      // Deux curseurs qu'on croise ne doivent pas rendre « aucun produit »,
      // qui se lirait comme un catalogue vide et non comme un filtre absurde.
      const f = parseFilters({ priceMin: '900', priceMax: '100' });
      expect(f.priceMinCents).toBe(10000);
      expect(f.priceMaxCents).toBe(90000);
    });

    it('ramene un prix negatif a zero', () => {
      expect(parseFilters({ priceMin: '-50' }).priceMinCents).toBe(0);
    });

    it('ignore ce qui n est pas un nombre', () => {
      for (const v of ['abc', '', 'NaN', '1e', undefined]) {
        expect(euroQueryToCents(v)).toBeUndefined();
      }
    });

    it('garde une borne meme si l autre est illisible', () => {
      const f = parseFilters({ priceMin: 'abc', priceMax: '500' });
      expect(f.priceMinCents).toBeUndefined();
      expect(f.priceMaxCents).toBe(50000);
    });

    it('accepte zero comme borne haute, qui est une demande reelle', () => {
      // « au plus 0 € » est absurde mais explicite ; ce n'est pas la meme chose
      // qu'un parametre absent, et les confondre ferait disparaitre le filtre.
      expect(parseFilters({ priceMax: '0' }).priceMaxCents).toBe(0);
    });
  });

  describe('note minimale', () => {
    it('retient une note demandee', () => {
      expect(parseFilters({ minRating: '4' }).minRating).toBe(4);
    });

    it('plafonne a 5', () => {
      expect(parseFilters({ minRating: '9' }).minRating).toBe(5);
    });

    it('traite zero et le negatif comme une absence de filtre', () => {
      // `0` est la valeur « tous » du modele mobile (`DEFAULT_FILTERS`), pas
      // une exigence de note.
      expect(parseFilters({ minRating: '0' }).minRating).toBeUndefined();
      expect(parseFilters({ minRating: '-2' }).minRating).toBeUndefined();
      expect(parseFilters({ minRating: 'quatre' }).minRating).toBeUndefined();
    });
  });
});
