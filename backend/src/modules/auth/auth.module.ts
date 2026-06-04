import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AddressesController } from '../addresses/addresses.controller';
import { AddressesService } from '../addresses/addresses.service';

@Module({
  controllers: [AuthController, AddressesController],
  providers: [AuthService, AddressesService],
  exports: [AuthService],
})
export class AuthModule {}
