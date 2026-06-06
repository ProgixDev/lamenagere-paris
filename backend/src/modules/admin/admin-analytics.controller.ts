import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from '@nestjs/common';
import { Roles } from '../../common/auth/roles.decorator';
import { AdminAnalyticsService } from './admin-analytics.service';

@Roles('admin', 'super_admin')
@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(private readonly analytics: AdminAnalyticsService) {}

  @Get()
  overview(@Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number) {
    return this.analytics.overview(Math.min(365, Math.max(1, days)));
  }
}
