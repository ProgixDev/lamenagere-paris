import React, { useEffect, useState, useCallback } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StripeGate } from "../components/StripeGate";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import {
  Cormorant_500Medium,
  Cormorant_600SemiBold,
  Cormorant_700Bold,
} from "@expo-google-fonts/cormorant";
import { Text as RNText, TextInput as RNTextInput } from "react-native";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { useAuthStore } from "../features/auth/store";
import { useOnboardingStore } from "../features/onboarding/store";
import AnimatedSplash from "../components/AnimatedSplash";
import {
  buildDeepLinkFromTarget,
  registerForPushNotifications,
  type CampaignTarget,
} from "../lib/notifications";
import { registerDeviceApi } from "../features/notifications/api";
import { useNotifInboxStore } from "../features/notifications/inbox";
import { PUSH_TOKEN_KEY } from "../lib/storage";
import "../lib/nativewind-interop";
import "../global.css";

SplashScreen.preventAutoHideAsync();

// The whole app uses Futura Now Headline Medium (the only licensed weight we
// have). Make it the default fontFamily so any Text/TextInput that doesn't set
// its own family still renders in Futura.
const APP_FONT = "FuturaNowHeadlineMedium";
const RNTextAny = RNText as any;
RNTextAny.defaultProps = RNTextAny.defaultProps || {};
RNTextAny.defaultProps.style = [{ fontFamily: APP_FONT }, RNTextAny.defaultProps.style];
const RNTextInputAny = RNTextInput as any;
RNTextInputAny.defaultProps = RNTextInputAny.defaultProps || {};
RNTextInputAny.defaultProps.style = [
  { fontFamily: APP_FONT },
  RNTextInputAny.defaultProps.style,
];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 2,
    },
  },
});

// Captures a delivered notification into the in-app inbox (so it shows up in
// the bell with an unread badge). Safe to call from both the foreground and the
// tap listeners — the store dedupes by id.
function recordToInbox(notification: Notifications.Notification) {
  const { request } = notification;
  const content = request.content;
  useNotifInboxStore.getState().add({
    id: request.identifier,
    title: content.title ?? "Notification",
    body: content.body ?? "",
    target: content.data?.target as CampaignTarget | undefined,
    receivedAt: Date.now(),
  });
}

function NotificationRouter() {
  const router = useRouter();
  useEffect(() => {
    // Foreground delivery → log to inbox.
    const received = Notifications.addNotificationReceivedListener((notification) => {
      recordToInbox(notification);
    });
    // Tap on a notification → log to inbox and follow its deep link.
    const response = Notifications.addNotificationResponseReceivedListener((res) => {
      recordToInbox(res.notification);
      const target = res.notification.request.content.data?.target as CampaignTarget | undefined;
      if (!target) return;
      router.push(buildDeepLinkFromTarget(target) as any);
    });
    return () => {
      received.remove();
      response.remove();
    };
  }, [router]);
  return null;
}

function PushRegistrar() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      const token = await registerForPushNotifications();
      if (!token || cancelled) return;
      try {
        await registerDeviceApi(token);
        await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
      } catch {
        // best-effort; will retry next launch
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);
  return null;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, loadSession, user } = useAuthStore();
  const hasSeenOnboarding = useOnboardingStore((s) => s.hasSeen);
  const onboardingHydrated = useOnboardingStore((s) => s.hydrated);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (isLoading || !onboardingHydrated) return;

    const seg = segments as string[];
    const inAuthGroup = seg[0] === "(auth)";
    const inOnboarding = seg[0] === "(onboarding)";
    const onCompleteProfile =
      inOnboarding && seg[1] === "complete-profile";

    // Signed in but profile not completed yet (mainly Google OAuth sign-ups):
    // force the interactive onboarding flow before anything else.
    if (isAuthenticated && user && !user.onboarded) {
      if (!onCompleteProfile) router.replace("/(onboarding)/complete-profile");
      return;
    }

    // First-launch marketing intro — only for visitors who aren't signed in.
    if (!hasSeenOnboarding && !isAuthenticated) {
      if (!inOnboarding || onCompleteProfile) router.replace("/(onboarding)");
      return;
    }

    if (isAuthenticated) {
      if (inAuthGroup || inOnboarding) {
        router.replace("/(tabs)");
      }
      return;
    }

    if (!inAuthGroup) {
      router.replace("/(auth)/login");
    }
  }, [
    isAuthenticated,
    isLoading,
    segments,
    router,
    hasSeenOnboarding,
    onboardingHydrated,
    user,
  ]);

  return <>{children}</>;
}

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);

  // Map every legacy font name (Inter_*/Manrope_*) used across the app to the
  // single licensed Futura file, so existing fontFamily references render in
  // Futura without touching dozens of component files.
  const futura = require("../assets/font/FuturaNowHeadlineMedium.ttf");
  const [fontsLoaded] = useFonts({
    [APP_FONT]: futura,
    Inter_300Light: futura,
    Inter_400Regular: futura,
    Inter_500Medium: futura,
    Inter_600SemiBold: futura,
    Inter_700Bold: futura,
    Manrope_700Bold: futura,
    Manrope_800ExtraBold: futura,
    // Cormorant — the elegant high-contrast serif used for display headings,
    // section titles and prices to give the catalog a premium "boutique" voice.
    Cormorant_500Medium,
    Cormorant_600SemiBold,
    Cormorant_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  const handleSplashFinish = useCallback(() => {
    setShowSplash(false);
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StripeGate>
            <AuthGate>
              <NotificationRouter />
              <PushRegistrar />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen
                  name="(onboarding)"
                  options={{ animation: "none" }}
                />
                <Stack.Screen
                  name="(auth)"
                  options={{ animation: "none" }}
                />
                <Stack.Screen
                  name="(tabs)"
                  options={{ animation: "none" }}
                />
                <Stack.Screen name="(main)" />
              </Stack>
              {showSplash && <AnimatedSplash onFinish={handleSplashFinish} />}
            </AuthGate>
          </StripeGate>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
