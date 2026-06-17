import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator';
import { AdminFeaturedService } from '../admin/admin-featured.service';

/**
 * Public storefront home payload for the mobile app: featured products,
 * active carousel slides and promo banners in one call.
 */
@Controller()
export class HomeController {
  constructor(private readonly featured: AdminFeaturedService) {}

  @Public()
  @Get('home')
  home() {
    return this.featured.home();
  }
}
