import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY",
  );
}

// SecureStore-backed storage so the PKCE code verifier survives the
// browser round-trip between signInWithOAuth() and exchangeCodeForSession().
const SecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) =>
    SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

// We do not persist the Supabase session itself — the app keeps its own
// access token in SecureStore and authenticates against the NestJS backend.
// This client only exists to perform the Google OAuth (PKCE) handshake.
export const supabase = createClient(url, anonKey, {
  auth: {
    storage: SecureStoreAdapter,
    flowType: "pkce",
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
