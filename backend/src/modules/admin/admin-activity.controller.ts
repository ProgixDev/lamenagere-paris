import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  Ip,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user';
import { ActivityService, ActivityKind } from '../../common/activity/activity.service';

@Roles('admin', 'super_admin', 'manager', 'editor', 'support')
@Controller('admin/activity')
export class AdminActivityController {
  constructor(private readonly activity: ActivityService) {}

  /** Called by the super_admin frontend after a successful Supabase sign-in. */
  @Post('login')
  @HttpCode(204)
  async logLogin(@CurrentUser() user: AuthUser, @Ip() ip: string) {
    await this.activity.log({
      kind: 'auth',
      actorId: user.id,
      actorEmail: user.email,
      summary: `Connexion — ${user.email}`,
      action: 'LOGIN',
      ipAddress: ip,
    });
  }

  @Get()
  @Roles('admin', 'super_admin')
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
  @Roles('admin', 'super_admin')
  userActivity(
    @Param('id') id: string,
    @Query('limit', new DefaultValuePipe(50)) limit?: number,
  ) {
    return this.activity.listForAdmin({ actorId: id, limit: Number(limit) });
  }
}
