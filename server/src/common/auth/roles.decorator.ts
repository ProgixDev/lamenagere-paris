import { SetMetadata } from '@nestjs/common';
import { UserRole } from './auth-user';

export const ROLES_KEY = 'roles';

/** Restricts a route (or controller) to the given roles. Used with RolesGuard. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
