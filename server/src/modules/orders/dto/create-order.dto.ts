import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ShippingZone } from '../../../common/serialization/status-labels';

const ZONES: ShippingZone[] = [
  'metropole',
  'reunion',
  'guadeloupe',
  'martinique',
  'guyane',
  'mayotte',
];

export class CustomDimensionsDto {
  @IsNumber() width!: number;
  @IsNumber() height!: number;
}

export class OrderItemInputDto {
  @IsString() productId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsOptional()
  @ValidateNested()
  @Type(() => CustomDimensionsDto)
  customDimensions?: CustomDimensionsDto;
  @IsOptional() @IsString() openingType?: string;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items!: OrderItemInputDto[];

  @IsString() shippingAddressId!: string;
  @IsString() shippingMethod!: string;
  @IsEnum(ZONES) territory!: ShippingZone;
}
