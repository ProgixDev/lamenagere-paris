import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator';
import { AdminFeaturedService } from '../admin/admin-featured.service';
import { AdminPopupsService } from '../admin/admin-popups.service';

/**
 * Public storefront home payload for the mobile app: featured products,
 * active carousel slides and promo banners in one call. Also serves each
 * category's curated "Notre sélection" rail and the active launch pop-ups.
 */
@Controller()
export class HomeController {
  constructor(
    private readonly featured: AdminFeaturedService,
    private readonly popups: AdminPopupsService,
  ) {}

  @Public()
  @Get('home')
  home() {
    return this.featured.home();
  }

  /** Active marketing pop-ups shown when the mobile app opens. */
  @Public()
  @Get('popups')
  activePopups() {
    return this.popups.listActive();
  }

  /** Admin-curated featured products for a single category (published only). */
  @Public()
  @Get('categories/:id/featured')
  categoryFeatured(@Param('id') id: string) {
    return this.featured.listFeaturedForCategory(id);
  }
}
