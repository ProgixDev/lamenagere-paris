import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { CategoriesService } from './categories.service';
import { ProductsService } from './products.service';
import { parseFilters } from './catalog-filters.util';

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

  @Public()
  @Get('products/search')
  search(
    @Query('q', new DefaultValuePipe('')) q: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('sort') sort?: string,
    @Query('priceMin') priceMin?: string,
    @Query('priceMax') priceMax?: string,
    @Query('minRating') minRating?: string,
  ) {
    return this.products.search(
      q,
      page,
      limit,
      parseFilters({ sort, priceMin, priceMax, minRating }),
    );
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
