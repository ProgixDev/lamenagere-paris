import React, { useEffect, useState, useCallback } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
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
import { PUSH_TOKEN_KEY } from "../lib/storage";
import "../lib/nativewind-interop";
import "../global.css";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 2,
    },
  },
});

function NotificationRouter() {
  const router = useRouter();
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const target = response.notification.request.content.data?.target as CampaignTarget | undefined;
      if (!target) return;
      router.push(buildDeepLinkFromTarget(target) as any);
    });
    return () => sub.remove();
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
  const { isAuthenticated, isLoading, loadSession } = useAuthStore();
  const hasSeenOnboarding = useOnboardingStore((s) => s.hasSeen);
  const onboardingHydrated = useOnboardingStore((s) => s.hydrated);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (isLoading || !onboardingHydrated) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "(onboarding)";

    // Onboarding wins over auth state: until it's marked seen, always show it.
    if (!hasSeenOnboarding) {
      if (!inOnboarding) router.replace("/(onboarding)");
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
  }, [isAuthenticated, isLoading, segments, router, hasSeenOnboarding, onboardingHydrated]);

  return <>{children}</>;
}

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);

  const [fontsLoaded] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
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
              <Stack.Screen name="(admin)" />
            </Stack>
          </AuthGate>
          {showSplash && <AnimatedSplash onFinish={handleSplashFinish} />}
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
