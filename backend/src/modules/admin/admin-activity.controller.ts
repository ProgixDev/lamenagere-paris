import { Controller, DefaultValuePipe, Get, Param, Query } from '@nestjs/common';
import { Roles } from '../../common/auth/roles.decorator';
import { ActivityService, ActivityKind } from '../../common/activity/activity.service';

@Roles('admin', 'super_admin')
@Controller('admin/activity')
export class AdminActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  list(
    @Query('actorId') actorId?: string,
    @Query('kind') kind?: ActivityKind,
    @Query('limit', new DefaultValuePipe(50)) limit?: number,
    @Query('offset', new DefaultValuePipe(0)) offset?: number,
  ) {
    return this.activity.listForAdmin({
      actorId,
      kind,
      limit: Number(limit),
      offset: Number(offset),
    });
  }

  @Get('user/:id')
  userActivity(
    @Param('id') id: string,
    @Query('limit', new DefaultValuePipe(50)) limit?: number,
  ) {
    return this.activity.listForAdmin({ actorId: id, limit: Number(limit) });
  }
}
