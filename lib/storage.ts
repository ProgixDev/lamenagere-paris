import * as SecureStore from "expo-secure-store";

export const storage = {
  async getItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
  },

  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  },
};

export const AUTH_TOKEN_KEY = "auth_token";
export const USER_KEY = "user";
export const CART_KEY = "cart";
export const FAVORITES_KEY = "favorites";
export const ONBOARDING_SEEN_KEY = "onboarding_seen";
export const PUSH_TOKEN_KEY = "push_token";
