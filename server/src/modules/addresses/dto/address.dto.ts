import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ShippingZone } from '../../../common/serialization/status-labels';

const ZONES: ShippingZone[] = [
  'metropole',
  'reunion',
  'guadeloupe',
  'martinique',
  'guyane',
  'mayotte',
];

export class CreateAddressDto {
  @IsString() @MinLength(1) firstName!: string;
  @IsString() @MinLength(1) lastName!: string;
  @IsString() @MinLength(1) street!: string;
  @IsString() @MinLength(1) postalCode!: string;
  @IsString() @MinLength(1) city!: string;
  @IsOptional() @IsString() country?: string;
  @IsEnum(ZONES) territory!: ShippingZone;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class UpdateAddressDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsEnum(ZONES) territory?: ShippingZone;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
