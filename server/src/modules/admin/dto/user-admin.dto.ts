import { IsEmail, IsIn, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { UserRole } from '../../../common/auth/auth-user';

const GRANTABLE_ROLES: UserRole[] = ['admin', 'manager', 'editor', 'support'];

export class CreateAdminUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsIn(GRANTABLE_ROLES)
  role: UserRole;
}

export class UpdateAdminRoleDto {
  @IsIn(GRANTABLE_ROLES)
  role: UserRole;
}

export interface AdminUserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  lastActivityAt: string | null;
  createdAt: string;
}
