export type UserRole = 'customer' | 'admin' | 'super_admin';
export type AccountType = 'particulier' | 'professionnel';

/** Shape attached to the Fastify request after AuthGuard succeeds. */
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  accountType: AccountType;
}

export interface RequestWithUser {
  user?: AuthUser;
  headers: Record<string, string | string[] | undefined>;
}
