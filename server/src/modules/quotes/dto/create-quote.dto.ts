import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class QuoteDimensionsDto {
  @IsNumber() width!: number;
  @IsNumber() height!: number;
}

export class CreateQuoteDto {
  @IsString() productId!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => QuoteDimensionsDto)
  dimensions?: QuoteDimensionsDto;

  @IsOptional() @IsString() notes?: string;

  /** URLs already uploaded via /admin/media or a customer upload endpoint. */
  @IsOptional() @IsArray() images?: string[];
}
