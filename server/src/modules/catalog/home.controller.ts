import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator';
import { AdminFeaturedService } from '../admin/admin-featured.service';

/**
 * Public storefront home payload for the mobile app: featured products,
 * active carousel slides and promo banners in one call. Also serves each
 * category's curated "Notre sélection" rail.
 */
@Controller()
export class HomeController {
  constructor(private readonly featured: AdminFeaturedService) {}

  @Public()
  @Get('home')
  home() {
    return this.featured.home();
  }

  /** Admin-curated featured products for a single category (published only). */
  @Public()
  @Get('categories/:id/featured')
  categoryFeatured(@Param('id') id: string) {
    return this.featured.listFeaturedForCategory(id);
  }
}
