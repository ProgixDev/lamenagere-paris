import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter, useSegments } from "expo-router";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "./ui/Icon";
import { COLORS } from "../lib/constants";
import { FONTS } from "../lib/typography";
import { useAuthStore } from "../features/auth/store";
import { useGuestStore } from "../features/auth/guest";

/**
 * Wraps the navigation stack and, whenever the visitor is browsing as a guest
 * (ghost mode) on a main/tab screen, pins a persistent top banner reminding
 * them they are not signed in. The banner consumes the top safe-area inset and
 * we hand the children a top inset of 0 so screens sit flush below it (no
 * double gap). On auth / onboarding screens nothing is added.
 */
export default function GuestModeChrome({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isGuest = useGuestStore((s) => s.isGuest);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const segments = useSegments() as string[];
  const seg0 = segments[0];
  const onMain = seg0 === "(tabs)" || seg0 === "(main)";
  const show = isGuest && !isAuthenticated && onMain;

  return (
    <View style={{ flex: 1, backgroundColor: show ? COLORS.primary : "transparent" }}>
      {show && (
        <View style={{ paddingTop: insets.top, backgroundColor: COLORS.primary }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingHorizontal: 16,
              paddingVertical: 9,
            }}
          >
            <Icon name="account-outline" size={16} color="#fff" />
            <Text style={{ flex: 1, fontSize: 12.5, fontFamily: FONTS.bodyMedium, color: "rgba(255,255,255,0.92)" }}>
              Mode invité · vous n'êtes pas connecté
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(auth)/login")}
              accessibilityRole="button"
              accessibilityLabel="Se connecter"
              hitSlop={8}
              style={{
                backgroundColor: "rgba(255,255,255,0.16)",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
              }}
            >
              <Text style={{ fontSize: 12, fontFamily: FONTS.bodySemibold, color: "#fff" }}>
                Se connecter
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <SafeAreaInsetsContext.Provider value={show ? { ...insets, top: 0 } : insets}>
        {children}
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}
