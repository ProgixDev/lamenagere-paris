import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
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
  const { data, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError || !data.session) {
    console.log("[oauth] exchange failed", exchangeError?.message);
    throw new Error("Connexion Google échouée");
  }
  console.log("[oauth] session obtained");
  return data.session.access_token;
}

/**
 * Runs the Supabase-hosted Google OAuth flow (PKCE) entirely client-side and
 * returns the resulting Supabase access token. That token is the same kind the
 * NestJS backend already validates via supabase.auth.getUser(), so callers can
 * store it and use it as the bearer token for every authenticated request.
 */
export async function signInWithGoogle(): Promise<string> {
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

  // Some platforms (notably Android) deliver the custom-scheme redirect through
  // the OS deep-link system instead of closing the auth tab, so listen for that
  // too and race it against the auth-session result.
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
}
