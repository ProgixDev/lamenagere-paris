import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user';
import { AdminCampaignsService } from './admin-campaigns.service';
import { UpsertCampaignDto } from './dto/campaign-admin.dto';

@Roles('admin', 'super_admin')
@Controller('admin/campaigns')
export class AdminCampaignsController {
  constructor(private readonly campaigns: AdminCampaignsService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.campaigns.list(status);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.campaigns.get(id);
  }

  @Post()
  create(@Body() dto: UpsertCampaignDto) {
    return this.campaigns.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpsertCampaignDto) {
    return this.campaigns.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.campaigns.remove(id);
  }

  @Post(':id/send')
  @HttpCode(200)
  send(@Param('id') id: string) {
    return this.campaigns.send(id);
  }

  @Post(':id/test')
  @HttpCode(200)
  test(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.campaigns.test(id, user.id);
  }
}
