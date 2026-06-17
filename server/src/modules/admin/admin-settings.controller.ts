import { Body, Controller, Get, Put } from '@nestjs/common';
import { Roles } from '../../common/auth/roles.decorator';
import { AdminSettingsService } from './admin-settings.service';
import {
  UpdateSettingsDto,
  UpdateZoneFeeDto,
} from './dto/settings-admin.dto';

@Roles('super_admin')
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly settings: AdminSettingsService) {}

  @Get()
  get() {
    return this.settings.get();
  }

  @Put()
  update(@Body() dto: UpdateSettingsDto) {
    return this.settings.update(dto);
  }

  @Put('shipping-zone')
  updateZone(@Body() dto: UpdateZoneFeeDto) {
    return this.settings.updateZone(dto);
  }
}
