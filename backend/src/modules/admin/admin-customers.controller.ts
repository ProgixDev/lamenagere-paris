import { Controller, Get, Param, Query } from '@nestjs/common';
import { Roles } from '../../common/auth/roles.decorator';
import { AccountType } from '../../common/serialization/status-labels';
import { AdminCustomersService } from './admin-customers.service';

@Roles('admin', 'super_admin')
@Controller('admin/customers')
export class AdminCustomersController {
  constructor(private readonly customers: AdminCustomersService) {}

  @Get()
  list(@Query('type') type?: AccountType, @Query('q') q?: string) {
    return this.customers.list({ type, q });
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.customers.detail(id);
  }
}
