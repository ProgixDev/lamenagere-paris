import type { AccountType, User } from "../../lib/types";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  accountType: AccountType;
  company?: string;
  siret?: string;
}

/** Fields collected by the post-OAuth onboarding flow. */
export interface CompleteProfilePayload {
  fullName: string;
  accountType: AccountType;
  phone?: string;
  company?: string;
  siret?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  completeProfile: (data: CompleteProfilePayload) => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
  setUser: (user: User) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}
