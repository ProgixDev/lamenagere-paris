export type UserRole =
  | 'customer'
  | 'support'   // messages, tickets, customers (read)
  | 'editor'    // products, categories, featured, campaigns
  | 'manager'   // orders, quotes, customers, messages, tickets
  | 'admin'     // full access except user management
  | 'super_admin'; // full access + user management

export const ADMIN_ROLES: UserRole[] = [
  'support',
  'editor',
  'manager',
  'admin',
  'super_admin',
];

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
