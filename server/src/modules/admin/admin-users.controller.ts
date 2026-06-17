import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user';
import { AdminUsersService } from './admin-users.service';
import { CreateAdminUserDto, UpdateAdminRoleDto } from './dto/user-admin.dto';

@Roles('super_admin')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Post()
  create(@Body() dto: CreateAdminUserDto) {
    return this.users.create(dto);
  }

  @Put(':id/role')
  updateRole(@Param('id') id: string, @Body() dto: UpdateAdminRoleDto) {
    return this.users.updateRole(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  revoke(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.users.revoke(id, actor.id);
  }
}
