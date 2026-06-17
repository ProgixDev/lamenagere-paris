import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator';
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

  @Public()
  @Get('products/:id')
  findOne(@Param('id') id: string) {
    return this.products.findOne(id);
  }
}
