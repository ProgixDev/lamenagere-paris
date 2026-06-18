import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Ip,
  Post,
  Put,
} from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth-user';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  UpdateProfileDto,
} from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.auth.login(dto, ip);
  }

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('logout')
  @HttpCode(200)
  logout() {
    return this.auth.logout();
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Get('profile')
  getProfile(@CurrentUser() user: AuthUser) {
    return this.auth.getProfile(user.id);
  }

  @Put('profile')
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.auth.updateProfile(user.id, dto);
  }

  @Post('change-password')
  @HttpCode(200)
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(
      user.id,
      user.email,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @Delete('account')
  @HttpCode(200)
  deleteAccount(@CurrentUser() user: AuthUser) {
    return this.auth.deleteAccount(user.id);
  }
}
