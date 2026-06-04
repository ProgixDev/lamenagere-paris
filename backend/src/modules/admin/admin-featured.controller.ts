import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { Roles } from '../../common/auth/roles.decorator';
import { AdminFeaturedService } from './admin-featured.service';
import {
  AddFeaturedDto,
  ReorderDto,
  UpsertBannerDto,
  UpsertSlideDto,
} from './dto/featured-admin.dto';

@Roles('admin', 'super_admin')
@Controller('admin/featured')
export class AdminFeaturedController {
  constructor(private readonly featured: AdminFeaturedService) {}

  // featured products
  @Get('products')
  listFeatured() {
    return this.featured.listFeatured();
  }

  @Post('products')
  @HttpCode(201)
  addFeatured(@Body() dto: AddFeaturedDto) {
    return this.featured.addFeatured(dto);
  }

  @Post('products/reorder')
  @HttpCode(200)
  reorderFeatured(@Body() dto: ReorderDto) {
    return this.featured.reorderFeatured(dto);
  }

  @Delete('products/:productId')
  @HttpCode(204)
  removeFeatured(@Param('productId') productId: string) {
    return this.featured.removeFeatured(productId);
  }

  // carousel
  @Get('carousel')
  listSlides() {
    return this.featured.listSlides();
  }

  @Post('carousel')
  createSlide(@Body() dto: UpsertSlideDto) {
    return this.featured.createSlide(dto);
  }

  @Put('carousel/:id')
  updateSlide(@Param('id') id: string, @Body() dto: UpsertSlideDto) {
    return this.featured.updateSlide(id, dto);
  }

  @Delete('carousel/:id')
  @HttpCode(204)
  deleteSlide(@Param('id') id: string) {
    return this.featured.deleteSlide(id);
  }

  // banners
  @Get('banners')
  listBanners() {
    return this.featured.listBanners();
  }

  @Post('banners')
  createBanner(@Body() dto: UpsertBannerDto) {
    return this.featured.createBanner(dto);
  }

  @Put('banners/:id')
  updateBanner(@Param('id') id: string, @Body() dto: UpsertBannerDto) {
    return this.featured.updateBanner(id, dto);
  }

  @Delete('banners/:id')
  @HttpCode(204)
  deleteBanner(@Param('id') id: string) {
    return this.featured.deleteBanner(id);
  }
}
