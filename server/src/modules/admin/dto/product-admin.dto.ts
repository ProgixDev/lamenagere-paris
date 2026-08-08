import {
  AREA_FORMULA_KEYS,
  type AreaFormulaKey,
} from '../../../common/pricing/area-formulas';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ConfigBlock } from '../../catalog/catalog.serializer';

export type ProductType = 'standard' | 'quote_only' | 'configurable';
export type PriceMode = 'fixed' | 'calculated' | 'per_sqm' | 'quote';
export type ProductStatus = 'publie' | 'brouillon' | 'archive';

/** One allowed opening type for a product, with its surcharge (in euros). */
export class OpeningTypeDto {
  @IsString() type!: string;
  @IsNumber() surcharge!: number;
}

/** One quality tier for a per_sqm product, with its own €/m² rate (euros). */
export class QualityTierDto {
  @IsString() key!: string;
  @IsString() label!: string;
  @IsNumber() pricePerSqm!: number;
}

/** One colour variant of a product, with its own gallery image URLs. */
export class ProductColorDto {
  @IsString() key!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() hex?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) images?: string[];
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
  /** Which dimensions a per_sqm product is billed on. */
  @IsOptional()
  @IsEnum(AREA_FORMULA_KEYS)
  areaFormula?: AreaFormulaKey;

  // Allowed opening types + per-type surcharge (euros).
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OpeningTypeDto)
  openingTypes?: OpeningTypeDto[];

  // Quality tiers for per_sqm products, each with its own €/m² rate.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QualityTierDto)
  qualityTiers?: QualityTierDto[];

  // Colour variants, each with its own gallery images.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductColorDto)
  colors?: ProductColorDto[];

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
  /** Units one order may take of a standard product; omitted = no cap. */
  @IsOptional() @IsInt() @Min(1) maxPerOrder?: number;

  @IsOptional() @IsString() seoTitle?: string;
  @IsOptional() @IsString() seoDescription?: string;

  /** Optional ordered media URLs already uploaded via /admin/media. */
  @IsOptional() @IsArray() imageUrls?: string[];
  @IsOptional() @IsArray() videoUrls?: string[];

  /**
   * Per-product override of the category's config blocks. Empty/omitted →
   * the product inherits its category template (stored as null).
   */
  @IsOptional() @IsArray() configBlocks?: ConfigBlock[];
}

export class BulkActionDto {
  @IsArray() ids!: string[];
  @IsEnum(['publish', 'draft', 'archive', 'delete']) action!:
    | 'publish'
    | 'draft'
    | 'archive'
    | 'delete';
}
