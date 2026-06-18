import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import type { User } from "../../lib/types";
import type {
  AuthActions,
  AuthState,
  CompleteProfilePayload,
  RegisterPayload,
} from "./types";
import {
  deleteAccountApi,
  getProfileApi,
  loginApi,
  logoutApi,
  registerApi,
  updateProfileApi,
} from "./api";
import { signInWithGoogle } from "./oauth";
import { unregisterDeviceApi } from "../notifications/api";
import { AUTH_TOKEN_KEY, PUSH_TOKEN_KEY, USER_KEY } from "../../lib/storage";

type AuthStore = AuthState & AuthActions;

function errorMessage(e: unknown): string {
  const m = (e as { message?: string })?.message;
  return m ?? "Une erreur s’est produite";
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const { user, token } = await loginApi({ email, password });
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: errorMessage(e), isAuthenticated: false });
      throw e;
    }
  },

  loginWithGoogle: async () => {
    set({ isLoading: true, error: null });
    try {
      // Supabase-hosted Google OAuth (PKCE) yields a Supabase access token,
      // which the backend accepts as a bearer token. Store it first so the
      // profile request below authenticates with it.
      const token = await signInWithGoogle();
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
      const user = await getProfileApi();
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (e) {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
      set({ isLoading: false, error: errorMessage(e), isAuthenticated: false });
      throw e;
    }
  },

  register: async (data: RegisterPayload) => {
    set({ isLoading: true, error: null });
    try {
      const { user, token } = await registerApi(data);
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: errorMessage(e), isAuthenticated: false });
      throw e;
    }
  },

  completeProfile: async (data: CompleteProfilePayload) => {
    set({ isLoading: true, error: null });
    try {
      const user = await updateProfileApi({
        fullName: data.fullName,
        accountType: data.accountType,
        phone: data.phone,
        company: data.company,
        siret: data.siret,
        onboarded: true,
      });
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: errorMessage(e) });
      throw e;
    }
  },

  updateProfile: async (data: Partial<User>) => {
    set({ isLoading: true, error: null });
    try {
      const user = await updateProfileApi(data);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      set({ user, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: errorMessage(e) });
      throw e;
    }
  },

  deleteAccount: async () => {
    set({ isLoading: true, error: null });
    try {
      await deleteAccountApi();
    } catch (e) {
      set({ isLoading: false, error: errorMessage(e) });
      throw e;
    }
    // Success: tear down the local session like a logout.
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  },

  logout: async () => {
    try {
      const pushToken = await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
      if (pushToken) await unregisterDeviceApi(pushToken);
    } catch {
      // ignore push unregister errors
    }
    try {
      await logoutApi();
    } catch {
      // ignore logout API errors
    }
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  },

  loadSession: async () => {
    set({ isLoading: true });
    try {
      const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      const userJson = await SecureStore.getItemAsync(USER_KEY);
      if (token && userJson) {
        const user: User = JSON.parse(userJson);
        set({ user, token, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  setUser: (user: User) => set({ user }),

  setError: (error: string | null) => set({ error }),

  clearError: () => set({ error: null }),
}));
