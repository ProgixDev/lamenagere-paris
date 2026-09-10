import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { Roles } from '../../common/auth/roles.decorator';
import { AdminLeadsService } from './admin-leads.service';
import { UpdateLeadDto } from './dto/lead-admin.dto';

/**
 * The contact-form inbox.
 *
 * Reading is admin-only. Deliberately **not** guarded by `BRIEF_OWNER_KEY`:
 * that key exists because a brief is shown to the prospect it belongs to, and
 * leads have no such audience — they are internal from the moment they arrive.
 */
@Roles('admin', 'super_admin', 'manager')
@Controller('admin/leads')
export class AdminLeadsController {
  constructor(private readonly leads: AdminLeadsService) {}

  @Get()
  list(@Query('status') statut?: string) {
    return this.leads.list(statut);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.leads.detail(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.leads.update(id, dto);
  }
}
