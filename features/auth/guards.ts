import { useCallback } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "./store";
import { useGuestStore } from "./guest";

/**
 * True while the visitor is browsing in guest ("ghost") mode without an account.
 * Screens that hold personal data — orders, addresses, profile, support — use
 * this to render <GuestGate /> instead of firing authenticated requests that
 * would only come back 401.
 */
export function useIsGuestVisitor(): boolean {
  const isGuest = useGuestStore((s) => s.isGuest);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isGuest && !isAuthenticated;
}

/**
 * Guard for individual *actions* a guest may tap on an otherwise browsable
 * screen (order, quote request, review, support message). Returns a function
 * that runs `action` when the visitor is signed in, and otherwise prompts them
 * to authenticate.
 *
 *   const requireAuth = useRequireAuth();
 *   <Button onPress={() => requireAuth(() => setDevisOpen(true), {
 *     message: "Connectez-vous pour demander un devis.",
 *   })} />
 *
 * Browsing stays open to everyone (App Store 5.1.1(v) — registration is only
 * required where the account is genuinely needed); this is what draws the line
 * at the point of purchase.
 */
export function useRequireAuth() {
  const isGuestVisitor = useIsGuestVisitor();
  const router = useRouter();

  return useCallback(
    (
      action: () => void,
      opts?: { title?: string; message?: string },
    ) => {
      if (!isGuestVisitor) {
        action();
        return;
      }
      Alert.alert(
        opts?.title ?? "Connexion requise",
        opts?.message ??
          "Connectez-vous ou créez un compte pour continuer.",
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Se connecter",
            onPress: () => router.push("/(auth)/login"),
          },
        ],
      );
    },
    [isGuestVisitor, router],
  );
}
