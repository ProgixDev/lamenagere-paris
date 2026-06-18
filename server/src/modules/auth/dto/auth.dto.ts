import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export type AccountType = 'particulier' | 'professionnel';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class RegisterDto {
  @IsString()
  @MinLength(1)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsEnum(['particulier', 'professionnel'])
  accountType!: AccountType;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  siret?: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEnum(['particulier', 'professionnel'])
  accountType?: AccountType;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  siret?: string;

  @IsOptional()
  @IsBoolean()
  onboarded?: boolean;
}
