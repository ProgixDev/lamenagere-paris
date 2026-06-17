import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class AddFeaturedDto {
  @IsString() productId!: string;
}

export class UpsertSlideDto {
  @IsEnum(['image', 'video']) kind!: 'image' | 'video';
  @IsString() @MinLength(1) title!: string;
  @IsOptional() @IsString() subtitle?: string;
  @IsString() @MinLength(1) mediaUrl!: string;
  @IsOptional() @IsEnum(['none', 'category', 'product']) linkKind?:
    | 'none'
    | 'category'
    | 'product';
  @IsOptional() @IsString() linkCategoryId?: string;
  @IsOptional() @IsString() linkProductId?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpsertBannerDto {
  @IsOptional() @IsString() badge?: string;
  @IsString() @MinLength(1) title!: string;
  @IsOptional() @IsString() subtitle?: string;
  @IsOptional() @IsString() style?: string;
  @IsOptional() @IsString() startsAt?: string;
  @IsOptional() @IsString() endsAt?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ReorderDto {
  @IsArray() ids!: string[];
}
