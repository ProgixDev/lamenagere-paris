import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class PromoLineItemDto {
  @IsOptional() @IsString() productId?: string;
  /** Client-computed line total (display preview only; re-priced at checkout). */
  @IsInt() lineTotalCents!: number;
}

export class ValidatePromoDto {
  @IsString() @MinLength(1) code!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromoLineItemDto)
  items!: PromoLineItemDto[];
}
