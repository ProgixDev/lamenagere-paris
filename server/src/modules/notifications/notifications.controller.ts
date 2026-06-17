import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto, UnregisterDeviceDto } from './dto/device.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly devices: DevicesService) {}

  @Post('register-device')
  @HttpCode(200)
  register(@CurrentUser() user: AuthUser, @Body() dto: RegisterDeviceDto) {
    return this.devices.register(user.id, dto);
  }

  @Post('unregister-device')
  @HttpCode(200)
  unregister(
    @CurrentUser() user: AuthUser,
    @Body() dto: UnregisterDeviceDto,
  ) {
    return this.devices.unregister(user.id, dto.token);
  }
}
