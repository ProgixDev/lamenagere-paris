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

  // ── Verrou de version de l'app mobile ────────────────────────────────────
  @IsOptional() @IsBoolean() forceUpdateEnabled?: boolean;
  /** Version sémantique ("1.3.0") ou chaîne vide pour retirer le minimum. */
  @IsOptional() @IsString() minAppVersionIos?: string;
  @IsOptional() @IsString() minAppVersionAndroid?: string;
  @IsOptional() @IsString() iosStoreUrl?: string;
  @IsOptional() @IsString() androidStoreUrl?: string;
  @IsOptional() @IsString() forceUpdateMessage?: string;
}

export class UpdateZoneFeeDto {
  @IsString() zone!: string;
  @IsString() delay!: string;
  @IsInt() feeCents!: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
