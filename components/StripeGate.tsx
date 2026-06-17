import React from "react";
import { NativeModules } from "react-native";
import { StripeProvider } from "@stripe/stripe-react-native";

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

export function StripeGate({ children }: { children: React.ReactElement }) {
  if (!isStripeAvailable()) {
    return children;
  }
  return (
    <StripeProvider
      publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""}
    >
      {children}
    </StripeProvider>
  );
}
