import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { QuoteStatus } from '../../../common/serialization/status-labels';

const STATUSES: QuoteStatus[] = [
  'en_attente_devis',
  'devis_envoye',
  'devis_accepte',
  'devis_rejete',
];

export class QuoteItemDto {
  @IsString() @MinLength(1) description!: string;
  @IsInt() quantity!: number;
  @IsNumber() unitPrice!: number; // euros
}

export class UpdateQuoteDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items?: QuoteItemDto[];

  @IsOptional() @IsNumber() shipping?: number; // euros
  @IsOptional() @IsString() fabricationDelay?: string;
  @IsOptional() @IsInt() validityDays?: number;
  @IsOptional() @IsString() adminMessage?: string;
  @IsOptional() @IsNumber() tvaRate?: number;
  @IsOptional() @IsString() pdfUrl?: string;
  @IsOptional() @IsNumber() quotedPrice?: number; // euros, overrides item sum
}

export class UpdateQuoteStatusDto {
  @IsEnum(STATUSES) status!: QuoteStatus;
}
