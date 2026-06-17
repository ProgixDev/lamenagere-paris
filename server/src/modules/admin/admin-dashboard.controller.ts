import { Controller, Get } from '@nestjs/common';
import { Roles } from '../../common/auth/roles.decorator';
import { AdminDashboardService } from './admin-dashboard.service';

@Roles('admin', 'super_admin', 'manager', 'editor', 'support')
@Controller('admin')
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  /** Consumed by both the mobile admin screen and super_admin. */
  @Get('stats')
  stats() {
    return this.dashboard.stats();
  }

  @Get('dashboard')
  full() {
    return this.dashboard.dashboard();
  }
}
