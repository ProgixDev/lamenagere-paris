import { Module } from '@nestjs/common';
import { AdminProductsController } from './admin-products.controller';
import { AdminProductsService } from './admin-products.service';
import { AdminCategoriesController } from './admin-categories.controller';
import { AdminCategoriesService } from './admin-categories.service';
import { AdminMediaController } from './admin-media.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';
import { AdminQuotesController } from './admin-quotes.controller';
import { AdminQuotesService } from './admin-quotes.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminCustomersController } from './admin-customers.controller';
import { AdminCustomersService } from './admin-customers.service';
import { AdminFeaturedController } from './admin-featured.controller';
import { AdminFeaturedService } from './admin-featured.service';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminSettingsService } from './admin-settings.service';
import { AdminConversationsController } from './admin-conversations.controller';
import { AdminConversationsService } from './admin-conversations.service';
import { AdminCampaignsController } from './admin-campaigns.controller';
import { AdminCampaignsService } from './admin-campaigns.service';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from './admin-analytics.service';
import { HomeController } from '../catalog/home.controller';

/**
 * Admin surface (all controllers gated with @Roles('admin','super_admin'))
 * plus the public storefront HomeController (carousel/banners/featured).
 * Campaigns + push are added in iteration 6.
 */
@Module({
  controllers: [
    AdminProductsController,
    AdminCategoriesController,
    AdminMediaController,
    AdminOrdersController,
    AdminQuotesController,
    AdminDashboardController,
    AdminCustomersController,
    AdminFeaturedController,
    AdminSettingsController,
    AdminConversationsController,
    AdminCampaignsController,
    AdminAnalyticsController,
    HomeController,
  ],
  providers: [
    AdminProductsService,
    AdminCategoriesService,
    AdminOrdersService,
    AdminQuotesService,
    AdminDashboardService,
    AdminCustomersService,
    AdminFeaturedService,
    AdminSettingsService,
    AdminConversationsService,
    AdminCampaignsService,
    AdminAnalyticsService,
  ],
})
export class AdminModule {}
