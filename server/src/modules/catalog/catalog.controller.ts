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

/**
 * Public catalog endpoints consumed by the mobile app.
 * Contract note: /categories and /products/popular return bare arrays;
 * /categories/:id/products and /products/search return PaginatedResponse<T>.
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

  @Public()
  @Get('categories/:id/products')
  productsByCategory(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.products.listByCategory(id, page, limit);
  }

  @Public()
  @Get('products/search')
  search(
    @Query('q', new DefaultValuePipe('')) q: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.products.search(q, page, limit);
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

  @Public()
  @Get('products/:id')
  findOne(@Param('id') id: string) {
    return this.products.findOne(id);
  }
}
