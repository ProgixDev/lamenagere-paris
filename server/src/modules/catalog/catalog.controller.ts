import {
  Controller,
  DefaultValuePipe,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { CategoriesService } from './categories.service';
import { ProductsService } from './products.service';
import { parseFilters, parseListe } from './catalog-filters.util';

/**
 * Public catalog endpoints, consumed by the mobile app and the web storefront.
 *
 * Contract note: /categories and /products/popular return bare arrays;
 * /categories/:id/products and /products/search return PaginatedResponse<T>.
 *
 * Two additions for the storefront, both backward compatible:
 *
 *  - `:id` accepts a **slug** as well as a UUID on `/products/:id` and
 *    `/categories/:id/products`. The web's URLs carry slugs, because a
 *    catalogue URL with a UUID in it cannot be read, shared or indexed.
 *  - the two paginated listings accept `sort`, `priceMin`, `priceMax` and
 *    `minRating`. Omitted, they order by popularity exactly as before.
 */
@Controller()
export class CatalogController {
  constructor(
    private readonly categories: CategoriesService,
    private readonly products: ProductsService,
    private readonly supabase: SupabaseService,
  ) {}

  @Public()
  @Get('categories')
  listCategories() {
    return this.categories.listVisible();
  }

  /**
   * Products in a category.
   *
   * `:id` accepts a UUID (the mobile app) or a slug (the storefront, whose URL
   * is `/boutique/cuisines`). An unknown slug 404s through `resolveId`, which
   * is what a category page that does not exist should do; an unknown UUID
   * keeps its historical behaviour of an empty page, since resolving one costs
   * a query the app has no reason to pay for.
   */
  @Public()
  @Get('categories/:id/products')
  async productsByCategory(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('sort') sort?: string,
    @Query('priceMin') priceMin?: string,
    @Query('priceMax') priceMax?: string,
    @Query('minRating') minRating?: string,
  ) {
    const categoryId = await this.categories.resolveId(id);
    return this.products.listByCategory(
      categoryId,
      page,
      limit,
      parseFilters({ sort, priceMin, priceMax, minRating }),
    );
  }

  /**
   * Search.
   *
   * `cat` and `type` are repeatable (`?cat=cuisines&cat=portes`) or
   * comma-joined (`?cat=cuisines,portes`) — under the Fastify adapter the first
   * form arrives as `string[]` and the second as `string`, so both parameters
   * are typed for both and `parseListe` flattens them. The storefront's no-JS
   * filter form produces the repeated shape; its JS island produces the comma
   * shape; the same URL has to work either way.
   */
  @Public()
  @Get('products/search')
  async search(
    @Query('q', new DefaultValuePipe('')) q: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('sort') sort?: string,
    @Query('priceMin') priceMin?: string,
    @Query('priceMax') priceMax?: string,
    @Query('minRating') minRating?: string,
    @Query('cat') cat?: string | string[],
    @Query('type') type?: string | string[],
    @Query('w') w?: string,
    @Query('h') h?: string,
  ) {
    const filters = parseFilters({
      sort,
      priceMin,
      priceMax,
      minRating,
      type,
      w,
      h,
    });

    // Résolu ici et non dans le service, comme `productsByCategory` : le
    // service ne voit que des UUID, donc il reste à une seule requête.
    const slugs = parseListe(cat);
    if (slugs.length) {
      const ids = await this.categories.resolveIds(slugs);
      // Aucun slug connu : on n'ajoute pas le filtre. Un `.in()` vide ne rend
      // rien, et une URL partagée dont la rubrique a été renommée doit rendre
      // la recherche, pas une page vide.
      if (ids.length) filters.categoryIds = ids;
    }

    return this.products.search(q, page, limit, filters);
  }

  /**
   * Search-as-you-type, for the storefront's header panel.
   *
   * ⚠️ **Must stay above `products/:id`**, which is declared last on purpose at
   * the bottom of this file: route matching is ordered, and `:id` would
   * otherwise swallow `suggest` and look up a product with that slug.
   *
   * Returns a **bare array**, like `/products/popular` and `/products/by-ids` —
   * nothing here paginates. The contract note at the top of this file already
   * documents that irregularity.
   *
   * The cache header is what makes the hot prefixes ("cui", "cuis", "cuisi")
   * cheap: they are the same for every visitor, so an edge that holds them for
   * a minute absorbs most of the typing in the catalogue. `max-age=0` keeps the
   * browser from serving a stale suggestion after the back office republishes.
   */
  @Public()
  @Get('products/suggest')
  @Header(
    'Cache-Control',
    'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
  )
  async suggest(
    @Query('q', new DefaultValuePipe('')) q: string,
    @Query('limit', new DefaultValuePipe(8), ParseIntPipe) limit: number,
    @Query('priceMin') priceMin?: string,
    @Query('priceMax') priceMax?: string,
    @Query('minRating') minRating?: string,
    @Query('cat') cat?: string | string[],
    @Query('type') type?: string | string[],
    @Query('w') w?: string,
    @Query('h') h?: string,
  ) {
    const filters = parseFilters({ priceMin, priceMax, minRating, type, w, h });

    const slugs = parseListe(cat);
    if (slugs.length) {
      const ids = await this.categories.resolveIds(slugs);
      if (ids.length) filters.categoryIds = ids;
    }

    return this.products.suggest(q, limit, filters);
  }

  /**
   * The newest published products, in the suggestion shape — what the header
   * panel shows before anything is typed.
   *
   * ⚠️ Same constraint as `suggest`: **must stay above `products/:id`**.
   */
  @Public()
  @Get('products/latest')
  @Header(
    'Cache-Control',
    'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
  )
  async latest(
    @Query('limit', new DefaultValuePipe(8), ParseIntPipe) limit: number,
    @Query('priceMin') priceMin?: string,
    @Query('priceMax') priceMax?: string,
    @Query('minRating') minRating?: string,
    @Query('cat') cat?: string | string[],
    @Query('type') type?: string | string[],
    @Query('w') w?: string,
    @Query('h') h?: string,
  ) {
    const filters = parseFilters({ priceMin, priceMax, minRating, type, w, h });

    const slugs = parseListe(cat);
    if (slugs.length) {
      const ids = await this.categories.resolveIds(slugs);
      if (ids.length) filters.categoryIds = ids;
    }

    return this.products.latest(limit, filters);
  }

  /**
   * The spread of published prices, for the storefront's price-range slider.
   *
   * ⚠️ Same constraint as `suggest`: **must stay above `products/:id`**.
   */
  @Public()
  @Get('products/price-histogram')
  @Header(
    'Cache-Control',
    'public, max-age=0, s-maxage=300, stale-while-revalidate=900',
  )
  priceHistogram() {
    return this.products.priceHistogram();
  }

  @Public()
  @Get('products/popular')
  popular(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.products.popular(limit);
  }

  /** Batch fetch by ids (favorites, featured). Declared before :id. */
  @Public()
  @Get('products/by-ids')
  byIds(@Query('ids', new DefaultValuePipe('')) ids: string) {
    const list = ids.split(',').map((s) => s.trim()).filter(Boolean);
    return this.products.listByIds(list);
  }

  /** Public shipping fee + delay per territory (from shipping_zone_fees). */
  @Public()
  @Get('shipping/options')
  async shippingOptions() {
    const { data } = await this.supabase.client
      .from('shipping_zone_fees')
      .select('zone, delay, fee_cents')
      .returns<{ zone: string; delay: string; fee_cents: number }[]>();
    return (data ?? []).map((r) => ({
      territory: r.zone,
      delay: r.delay,
      fee: (r.fee_cents ?? 0) / 100,
    }));
  }

  /** A product by UUID (mobile) or slug (`/boutique/p/:slug`). */
  @Public()
  @Get('products/:id')
  findOne(@Param('id') id: string) {
    return this.products.findOne(id);
  }
}
