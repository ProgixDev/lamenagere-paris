import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Roles } from '../../common/auth/roles.decorator';
import { AdminProductsService } from './admin-products.service';
import {
  BulkActionDto,
  ProductStatus,
  UpsertProductDto,
} from './dto/product-admin.dto';

@Roles('admin', 'super_admin', 'editor')
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly products: AdminProductsService) {}

  @Get()
  list(
    @Query('page', new DefaultValuePipe(1)) page: number,
    @Query('limit', new DefaultValuePipe(20)) limit: number,
    @Query('status') status?: ProductStatus,
    @Query('categoryId') categoryId?: string,
    @Query('q') q?: string,
  ) {
    return this.products.list({
      page: Number(page),
      limit: Number(limit),
      status,
      categoryId,
      q,
    });
  }

  @Post('bulk')
  @HttpCode(200)
  bulk(@Body() dto: BulkActionDto) {
    return this.products.bulk(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.products.getRaw(id).then((r) => r);
  }

  @Post()
  create(@Body() dto: UpsertProductDto) {
    return this.products.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpsertProductDto) {
    return this.products.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.products.remove(id);
  }

  @Post(':id/publish')
  @HttpCode(200)
  publish(@Param('id') id: string) {
    return this.products.setStatus(id, 'publie');
  }

  @Post(':id/archive')
  @HttpCode(200)
  archive(@Param('id') id: string) {
    return this.products.setStatus(id, 'archive');
  }
}
