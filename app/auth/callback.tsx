import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuthStore } from "../../features/auth/store";
import { isGoogleSignInPending } from "../../features/auth/oauth";
import { COLORS } from "../../lib/constants";

/**
 * Landing route for the Google OAuth redirect (`lamenagere://auth/callback`).
 *
 * On Android the Custom Tab redirect is usually handed to the app by the OS
 * deep-link system instead of closing the auth tab, so this route gets opened
 * for real — without it the user lands on expo-router's "Unmatched Route"
 * screen with the code visible in the URL.
 *
 * Two cases end up here:
 *  - a sign-in is still in flight: its own listener owns the code exchange, so
 *    we only wait for the session it produces;
 *  - nothing is in flight (the app was cold-started by the link): we finish the
 *    sign-in ourselves from the `code` query param.
 */
const WAIT_FOR_PENDING_MS = 15000;

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
  }>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let settled = false;
    const leave = (ok: boolean) => {
      if (settled) return;
      settled = true;
      // AuthGate takes it from here — it pushes users without a completed
      // profile to the onboarding flow.
      router.replace(ok ? "/(tabs)" : "/(auth)/login");
    };

    const code = typeof params.code === "string" ? params.code : null;
    const providerError =
      typeof params.error === "string" ? params.error : null;

    if (providerError) {
      useAuthStore
        .getState()
        .setError(
          (typeof params.error_description === "string" &&
            params.error_description) ||
            "Connexion Google échouée",
        );
      leave(false);
      return;
    }

    // A sign-in already running will exchange this code itself; wait for it to
    // land instead of racing it (the code is single-use).
    if (isGoogleSignInPending()) {
      if (useAuthStore.getState().isAuthenticated) {
        leave(true);
        return;
      }
      const unsubscribe = useAuthStore.subscribe((state) => {
        if (state.isAuthenticated) leave(true);
        else if (state.error && !state.isLoading) leave(false);
      });
      // Safety net: never strand the user on a spinner if that flow dies.
      const timer = setTimeout(() => {
        setFailed(true);
        leave(false);
      }, WAIT_FOR_PENDING_MS);
      return () => {
        unsubscribe();
        clearTimeout(timer);
      };
    }

    if (!code) {
      leave(false);
      return;
    }

    useAuthStore
      .getState()
      .finishGoogleLogin(code)
      .then(() => leave(true))
      .catch(() => {
        setFailed(true);
        leave(false);
      });
  }, [params.code, params.error, params.error_description, router]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.background,
        gap: 16,
      }}
    >
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={{ color: COLORS.onSurfaceVariant }}>
        {failed ? "Connexion Google échouée" : "Connexion en cours…"}
      </Text>
    </View>
  );
}
