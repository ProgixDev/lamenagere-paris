import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AppleService } from './apple.service';
import { AuthThrottleService } from './auth-throttle.service';
import { AddressesController } from '../addresses/addresses.controller';
import { AddressesService } from '../addresses/addresses.service';

@Module({
  controllers: [AuthController, AddressesController],
  providers: [AuthService, AppleService, AddressesService, AuthThrottleService],
  exports: [AuthService],
})
export class AuthModule {}
