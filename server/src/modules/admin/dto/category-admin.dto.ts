import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpsertCategoryDto {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() accentColor?: string;
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isVisible?: boolean;
  @IsOptional() @IsBoolean() isFeaturedHome?: boolean;
  @IsOptional() @IsBoolean() b2bOnly?: boolean;
  @IsOptional() @IsString() deliveryOverride?: string;
}

export class ReorderDto {
  /** Ordered list of ids; index becomes the new sort_order/position. */
  @IsArray() ids!: string[];
}
