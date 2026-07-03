import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpsertPopupDto {
  @IsOptional() @IsString() title?: string;
  @IsString() @MinLength(1) imageUrl!: string;
  @IsOptional() @IsString() imagePath?: string;
  @IsOptional() @IsEnum(['none', 'category', 'product']) linkKind?:
    | 'none'
    | 'category'
    | 'product';
  @IsOptional() @IsString() linkCategoryId?: string;
  @IsOptional() @IsString() linkProductId?: string;
  @IsOptional() @IsString() startsAt?: string;
  @IsOptional() @IsString() endsAt?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ReorderPopupsDto {
  @IsArray() ids!: string[];
}
