import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { OrderStatus } from '../../../common/serialization/status-labels';

const STATUSES: OrderStatus[] = [
  'commande_confirmee',
  'en_preparation',
  'en_attente_expedition',
  'expediee',
  'livree',
];

export class UpdateOrderStatusDto {
  @IsEnum(STATUSES) status!: OrderStatus;
  @IsOptional() @IsString() note?: string;
}

export class ShipOrderDto {
  @IsString() @MinLength(1) carrier!: string;
  @IsString() @MinLength(1) trackingNumber!: string;
  @IsOptional() @IsString() trackingUrl?: string;
}

export class AddOrderNoteDto {
  @IsString() @MinLength(1) body!: string;
}

export class UpdateOrderDto {
  @IsOptional() @IsString() estimatedDelivery?: string;
}

export class RejectRefundDto {
  @IsOptional() @IsString() note?: string;
}

export class AcceptRefundDto {
  /** Partial-refund amount in cents; omit for a full refund. */
  @IsOptional() @IsInt() @Min(1) amountCents?: number;
}

export class OrderListQuery {
  @IsOptional() @IsEnum(STATUSES) status?: OrderStatus;
  @IsOptional() @IsString() territory?: string;
  @IsOptional() @IsString() accountType?: string;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @Type(() => Number) @IsInt() page?: number;
  @IsOptional() @Type(() => Number) @IsInt() limit?: number;
}
