import {
  coteQueryToCm,
  euroQueryToCents,
  parseFilters,
  parseListe,
} from './catalog-filters.util';

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

  describe('parseListe', () => {
    it('lit la forme repetee, celle du formulaire sans JavaScript', () => {
      // `<input type="checkbox" name="cat">` coche deux fois donne ceci, et la
      // boutique doit fonctionner sans JavaScript : ce n'est pas un cas
      // theorique, c'est la forme par defaut.
      expect(parseListe(['cuisines', 'portes'])).toEqual(['cuisines', 'portes']);
    });

    it('lit la forme a virgules, celle de l’ilot et de /products/by-ids', () => {
      expect(parseListe('cuisines,portes')).toEqual(['cuisines', 'portes']);
    });

    it('lit un melange des deux, parce qu’une URL editee a la main en produit', () => {
      expect(parseListe(['cuisines,portes', 'chambres'])).toEqual([
        'cuisines',
        'portes',
        'chambres',
      ]);
    });

    it('rogne, jette les vides et dedoublonne', () => {
      expect(parseListe(' cuisines , , portes ,cuisines')).toEqual([
        'cuisines',
        'portes',
      ]);
    });

    it('rend un tableau vide pour une absence', () => {
      expect(parseListe(undefined)).toEqual([]);
      expect(parseListe('')).toEqual([]);
      expect(parseListe([])).toEqual([]);
    });
  });

  describe('type de produit', () => {
    it('retient les deux types qui existent vraiment', () => {
      expect(parseFilters({ type: 'configurable' }).productTypes).toEqual([
        'configurable',
      ]);
      expect(parseFilters({ type: ['standard', 'configurable'] }).productTypes)
        .toEqual(['standard', 'configurable']);
    });

    it('ignore quote_only, qui ne correspond a aucun produit', () => {
      // Valeur d'enum toujours valide en base, mais la migration 0012 a deplace
      // toutes les lignes et annonce qu'il n'en sera plus produit. L'accepter
      // rendrait un catalogue vide, ce qui se lit « plus rien en stock » et non
      // « ce filtre ne veut rien dire ».
      expect(parseFilters({ type: 'quote_only' }).productTypes).toBeUndefined();
    });

    it('ignore un libelle francais ou une valeur inconnue', () => {
      expect(parseFilters({ type: 'sur-mesure' }).productTypes).toBeUndefined();
      expect(parseFilters({ type: 'CONFIGURABLE' }).productTypes).toBeUndefined();
    });

    it('omet le champ plutot que de rendre un tableau vide', () => {
      // Un `.in('product_type', [])` ne rend aucune ligne : le champ absent et
      // le champ vide n'ont pas du tout le meme effet en aval.
      expect('productTypes' in parseFilters({ type: 'inconnu' })).toBe(false);
    });
  });

  describe('cotes', () => {
    it('retient une largeur et une hauteur en centimetres', () => {
      const f = parseFilters({ w: '240', h: '120' });
      expect(f.widthCm).toBe(240);
      expect(f.heightCm).toBe(120);
    });

    it('arrondit plutot que de refuser une mesure au demi-centimetre', () => {
      // Un client qui tape 240,5 a mesure soigneusement. Lui dire que sa mesure
      // est invalide serait absurde quand l'atelier verifie toutes les cotes.
      expect(parseFilters({ w: '240.5' }).widthCm).toBe(241);
    });

    it('ignore ce qui sort de [1, 2000] cm', () => {
      // Ce nombre finit interpole dans une chaine de filtre PostgREST : il doit
      // etre prouvablement un entier ordinaire. Et vingt metres n'est pas une
      // cuisine.
      for (const v of ['0', '-240', '2001', '99999']) {
        expect(coteQueryToCm(v)).toBeUndefined();
      }
    });

    it('ignore ce qui n est pas un nombre', () => {
      for (const v of ['deux metres', '', '240cm', undefined]) {
        expect(coteQueryToCm(v)).toBeUndefined();
      }
    });

    it('garde une cote meme si l autre est illisible', () => {
      const f = parseFilters({ w: '240', h: 'haut' });
      expect(f.widthCm).toBe(240);
      expect(f.heightCm).toBeUndefined();
    });
  });
});
