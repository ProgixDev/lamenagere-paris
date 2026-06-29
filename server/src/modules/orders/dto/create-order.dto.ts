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
import { ConfigSelectionEntry } from '../../catalog/catalog.serializer';

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
  /** Captured config-block selections (re-priced server-side). */
  @IsOptional() @IsArray() configuration?: ConfigSelectionEntry[];
  /** When set, this line is an admin-priced devis; its quoted price is used. */
  @IsOptional() @IsString() quoteId?: string;
}

const ATTACHMENT_TYPES = ['image', 'video'] as const;

export class OrderAttachmentDto {
  @IsString() url!: string;
  @IsEnum(ATTACHMENT_TYPES) type!: 'image' | 'video';
}

export class ShippingAddressInputDto {
  @IsString() firstName!: string;
  @IsString() lastName!: string;
  @IsString() street!: string;
  @IsString() postalCode!: string;
  @IsString() city!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsEnum(ZONES) territory?: ShippingZone;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items!: OrderItemInputDto[];

  /** Either a saved address id OR an inline delivery form (one is required). */
  @IsOptional() @IsString() shippingAddressId?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingAddressInputDto)
  shippingAddress?: ShippingAddressInputDto;

  @IsString() shippingMethod!: string;
  @IsOptional() @IsEnum(ZONES) territory?: ShippingZone;

  /** Optional free-text note from the buyer describing their order. */
  @IsOptional() @IsString() customerNote?: string;

  /** Optional photos/videos the buyer attached to their order. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderAttachmentDto)
  customerAttachments?: OrderAttachmentDto[];
}
