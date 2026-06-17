import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
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
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminActivityController } from './admin-activity.controller';
import { AuditInterceptor } from '../../common/interceptors/audit.interceptor';
import { HomeController } from '../catalog/home.controller';

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
    AdminUsersController,
    AdminActivityController,
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
    AdminUsersService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AdminModule {}
