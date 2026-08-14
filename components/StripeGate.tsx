import React, { useEffect } from "react";
import { NativeModules } from "react-native";
import * as Linking from "expo-linking";
import { StripeProvider, useStripe } from "@stripe/stripe-react-native";

/**
 * `@stripe/stripe-react-native` is a native module. In Expo Go or a dev build
 * created before the package was added, the native side (`StripeSdk`) is absent
 * and mounting <StripeProvider> would crash the app on launch. This gate renders
 * the provider only when the native module AND a publishable key are present,
 * so the rest of the app boots normally; payment itself requires a fresh dev
 * build (see isStripeAvailable()).
 */
export const isStripeAvailable = (): boolean =>
  !!NativeModules.StripeSdk &&
  !!process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

/**
 * Redirect-based payment methods (3DS challenges, Klarna, Bancontact…) leave
 * the app and come back on the `returnURL` we pass to `initPaymentSheet`. The
 * SDK doesn't observe incoming links itself — it waits for the app to hand the
 * URL over — so without this the Payment Sheet would hang after the redirect.
 */
function StripeRedirectListener() {
  const { handleURLCallback } = useStripe();

  useEffect(() => {
    const forward = (url: string | null) => {
      if (url) handleURLCallback(url).catch(() => {});
    };
    // Cold start via the redirect, plus every link while we're running.
    Linking.getInitialURL().then(forward).catch(() => {});
    const sub = Linking.addEventListener("url", ({ url }) => forward(url));
    return () => sub.remove();
  }, [handleURLCallback]);

  return null;
}

export function StripeGate({ children }: { children: React.ReactElement }) {
  if (!isStripeAvailable()) {
    return children;
  }
  return (
    <StripeProvider
      publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""}
    >
      <>
        <StripeRedirectListener />
        {children}
      </>
    </StripeProvider>
  );
}
