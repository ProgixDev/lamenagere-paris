import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class UpsertPromoCodeDto {
  @IsString() @MinLength(2) code!: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(['percent', 'fixed']) discountType!: 'percent' | 'fixed';
  /** Percent (1-100) or fixed amount in cents. */
  @IsInt() @Min(1) discountValue!: number;
  /** null/omitted = global code; set = scoped to one product. */
  @IsOptional() @IsString() productId?: string | null;
  @IsOptional() @IsInt() @Min(0) minOrderCents?: number | null;
  @IsOptional() @IsInt() @Min(1) maxRedemptions?: number | null;
  @IsOptional() @IsInt() @Min(1) perCustomerLimit?: number | null;
  @IsOptional() @IsString() startsAt?: string | null;
  @IsOptional() @IsString() expiresAt?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
