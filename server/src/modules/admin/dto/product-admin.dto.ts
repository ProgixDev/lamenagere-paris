import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export type ProductType = 'standard' | 'quote_only' | 'configurable';
export type PriceMode = 'fixed' | 'calculated' | 'per_sqm' | 'quote';
export type ProductStatus = 'publie' | 'brouillon' | 'archive';

/** One allowed opening type for a product, with its surcharge (in euros). */
export class OpeningTypeDto {
  @IsString() type!: string;
  @IsNumber() surcharge!: number;
}

export class UpsertProductDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() shortDescription?: string;
  @IsString() categoryId!: string;
  @IsEnum(['standard', 'quote_only', 'configurable']) productType!: ProductType;
  @IsEnum(['fixed', 'calculated', 'per_sqm', 'quote']) priceMode!: PriceMode;
  @IsOptional() @IsEnum(['publie', 'brouillon', 'archive']) status?: ProductStatus;

  // Pricing in euros (converted to cents on write).
  @IsOptional() @IsNumber() price?: number;
  @IsOptional() @IsNumber() purchaseCost?: number;
  @IsOptional() @IsNumber() widthCoef?: number; // €/cm
  @IsOptional() @IsNumber() heightCoef?: number; // €/cm
  @IsOptional() @IsNumber() pricePerSqm?: number; // €/m²

  // Allowed opening types + per-type surcharge (euros).
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpeningTypeDto)
  openingTypes?: OpeningTypeDto[];

  // Dimensions (cm).
  @IsOptional() @IsNumber() dimWidth?: number;
  @IsOptional() @IsNumber() dimHeight?: number;
  @IsOptional() @IsNumber() dimDepth?: number;
  @IsOptional() @IsNumber() refWidth?: number;
  @IsOptional() @IsNumber() refHeight?: number;
  @IsOptional() @IsNumber() minWidth?: number;
  @IsOptional() @IsNumber() minHeight?: number;
  @IsOptional() @IsNumber() maxWidth?: number;
  @IsOptional() @IsNumber() maxHeight?: number;
  @IsOptional() @IsBoolean() customizable?: boolean;

  @IsOptional() @IsString() deliveryMetropole?: string;
  @IsOptional() @IsString() deliveryOutremer?: string;
  @IsOptional() @IsNumber() weightKg?: number;
  @IsOptional() @IsNumber() volumeM3?: number;
  @IsOptional() @IsBoolean() freeShipping?: boolean;

  @IsOptional() @IsInt() stockQty?: number;
  @IsOptional() @IsInt() lowStockThreshold?: number;

  @IsOptional() @IsString() seoTitle?: string;
  @IsOptional() @IsString() seoDescription?: string;
  @IsOptional() @IsBoolean() isFeatured?: boolean;

  /** Optional ordered media URLs already uploaded via /admin/media. */
  @IsOptional() @IsArray() imageUrls?: string[];
  @IsOptional() @IsArray() videoUrls?: string[];
}

export class BulkActionDto {
  @IsArray() ids!: string[];
  @IsEnum(['publish', 'draft', 'archive', 'delete']) action!:
    | 'publish'
    | 'draft'
    | 'archive'
    | 'delete';
}
