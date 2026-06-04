import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDeviceDto {
  @IsString() @MinLength(1) token!: string;
  @IsEnum(['ios', 'android']) platform!: 'ios' | 'android';
  @IsEnum(['fcm', 'expo', 'apns']) provider!: 'fcm' | 'expo' | 'apns';
  @IsOptional() @IsString() deviceId?: string;
}

export class UnregisterDeviceDto {
  @IsString() @MinLength(1) token!: string;
}
