import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional() @IsString() storeName?: string;
  @IsOptional() @IsString() contactEmail?: string;
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsString() warehouseAddress?: string;
  @IsOptional() @IsString() siret?: string;
  @IsOptional() @IsString() tvaIntracom?: string;
  @IsOptional() @IsNumber() tvaRate?: number;
  @IsOptional() @IsNumber() freeShippingThreshold?: number; // euros
  @IsOptional() @IsBoolean() autoShippingByWeight?: boolean;
  @IsOptional() @IsBoolean() maintenanceMode?: boolean;
  @IsOptional() @IsBoolean() depositEnabled?: boolean;
  @IsOptional() @IsNumber() depositThreshold?: number; // euros
}

export class UpdateZoneFeeDto {
  @IsString() zone!: string;
  @IsString() delay!: string;
  @IsInt() feeCents!: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
