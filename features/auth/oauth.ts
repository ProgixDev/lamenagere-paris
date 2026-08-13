import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as AppleAuthentication from "expo-apple-authentication";
import { supabase } from "../../lib/supabase";

WebBrowser.maybeCompleteAuthSession();

/** Pull auth params from either the query string (?code=) or the hash (#code=). */
function parseCallback(url: string): {
  code: string | null;
  error: string | null;
  errorDescription: string | null;
} {
  const parsed = new URL(url);
  const query = new URLSearchParams(parsed.search);
  const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  const get = (k: string) => query.get(k) ?? hash.get(k);
  return {
    code: get("code"),
    error: get("error"),
    errorDescription: get("error_description"),
  };
}

// A PKCE code is single-use. The same redirect can reach us twice — once
// through the in-flight sign-in below, once through the /auth/callback route
// Android's deep-link system opens — so exchanges are deduped by code and both
// callers share one result instead of racing (the loser would get "invalid
// request: code verifier should be non-empty").
const exchanges = new Map<string, Promise<string>>();

/** Trades an OAuth `code` for a Supabase access token, at most once per code. */
export function exchangeAuthCode(code: string): Promise<string> {
  const pending = exchanges.get(code);
  if (pending) return pending;

  const promise = (async () => {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.session) {
      console.log("[oauth] exchange failed", error?.message);
      throw new Error("Connexion Google échouée");
    }
    console.log("[oauth] session obtained");
    return data.session.access_token;
  })();

  exchanges.set(code, promise);
  // Let a failed attempt be retried; a successful one stays cached.
  promise.catch(() => exchanges.delete(code));
  return promise;
}

async function exchange(callbackUrl: string): Promise<string> {
  const { code, error, errorDescription } = parseCallback(callbackUrl);
  if (error) {
    console.log("[oauth] provider error", error, errorDescription);
    throw new Error(errorDescription || error);
  }
  if (!code) {
    console.log("[oauth] no code in callback url", callbackUrl);
    throw new Error("Connexion Google échouée");
  }
  return exchangeAuthCode(code);
}

// True while signInWithGoogle() is waiting for its redirect. The /auth/callback
// screen uses this to know whether it should finish the sign-in itself (the app
// was cold-started by the deep link) or just wait for the in-flight flow.
let googleSignInPending = false;

export function isGoogleSignInPending(): boolean {
  return googleSignInPending;
}

/** True when the OS can present the Apple sheet (iOS 13+; never on Android). */
export async function isAppleSignInAvailable(): Promise<boolean> {
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Sign in with Apple. Unlike Google (which goes through the Supabase-hosted web
 * flow) this uses the *native* sheet: Apple hands us an identity token that
 * Supabase verifies directly, so there is no browser round-trip and no redirect
 * to capture. Returns a Supabase access token, same contract as
 * signInWithGoogle, so callers are interchangeable.
 *
 * Apple only returns the user's name on the *first* authorization ever granted
 * for this app, so it is handed back to the caller to persist immediately —
 * there is no second chance to read it. It deliberately does NOT go through
 * supabase.auth.updateUser: the `handle_new_user` trigger copies
 * raw_user_meta_data into `profiles` at user-creation time, which already
 * happened inside signInWithIdToken below, so a metadata write afterwards would
 * never reach the profiles row.
 */
export async function signInWithApple(): Promise<{
  token: string;
  fullName: string | null;
  /** One-time code the server exchanges for a revocable refresh token. */
  authorizationCode: string | null;
}> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (e) {
    // The user dismissing the sheet surfaces as ERR_REQUEST_CANCELED; keep it
    // distinguishable so the UI can stay silent instead of showing an error.
    if ((e as { code?: string })?.code === "ERR_REQUEST_CANCELED") {
      throw new Error("Connexion Apple annulée");
    }
    throw new Error("Connexion Apple échouée");
  }

  if (!credential.identityToken) {
    throw new Error("Connexion Apple échouée");
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
  });
  if (error || !data.session) {
    console.log("[oauth] apple signInWithIdToken failed", error?.message);
    throw new Error("Connexion Apple échouée");
  }

  const { givenName, familyName } = credential.fullName ?? {};
  const fullName = [givenName, familyName].filter(Boolean).join(" ").trim();

  return {
    token: data.session.access_token,
    fullName: fullName || null,
    authorizationCode: credential.authorizationCode ?? null,
  };
}

/**
 * Runs the Supabase-hosted Google OAuth flow (PKCE) entirely client-side and
 * returns the resulting Supabase access token. That token is the same kind the
 * NestJS backend already validates via supabase.auth.getUser(), so callers can
 * store it and use it as the bearer token for every authenticated request.
 */
export async function signInWithGoogle(): Promise<string> {
  googleSignInPending = true;
  try {
    const redirectTo = Linking.createURL("auth/callback");
    console.log("[oauth] redirectTo =", redirectTo);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data?.url) {
      console.log("[oauth] signInWithOAuth error", error?.message);
      throw new Error("Connexion Google échouée");
    }

    // Some platforms (notably Android) deliver the custom-scheme redirect
    // through the OS deep-link system instead of closing the auth tab, so
    // listen for that too and race it against the auth-session result.
    let onLink: (url: string) => void = () => {};
    const linkPromise = new Promise<string>((resolve) => {
      onLink = resolve;
    });
    const sub = Linking.addEventListener("url", (e) => onLink(e.url));

    try {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      console.log("[oauth] openAuthSession result", JSON.stringify(result));

      if (result.type === "success" && result.url) {
        return await exchange(result.url);
      }

      // Browser closed without handing us a URL — give a deep-link redirect a
      // brief window to arrive before treating it as a cancellation.
      const deepLinkUrl = await Promise.race([
        linkPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
      ]);
      if (deepLinkUrl) {
        return await exchange(deepLinkUrl);
      }

      console.log("[oauth] no redirect captured; result.type =", result.type);
      throw new Error("Connexion Google annulée");
    } finally {
      sub.remove();
    }
  } finally {
    googleSignInPending = false;
  }
}
