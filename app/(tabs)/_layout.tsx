import React from "react";
import { Platform, View, Text, StyleSheet } from "react-native";
import {
  NativeTabs,
  Icon,
  Label,
  Badge,
} from "expo-router/unstable-native-tabs";
import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { COLORS } from "../../lib/constants";
import { useCartItemCount } from "../../features/cart/store";
import { useMessagingStore } from "../../features/messaging/store";

export default function TabLayout() {
  const cartCount = useCartItemCount();
  const unreadCount = useMessagingStore((s) => s.unreadCount);

  // iOS: real native UITabBar → Liquid Glass on iOS 26 (translucent blur,
  // scroll-edge transparency, scroll-to-minimize). Leaving `backgroundColor`
  // unset is what keeps the glass material visible.
  if (Platform.OS === "ios") {
    return (
      <NativeTabs
        tintColor={COLORS.primary}
        minimizeBehavior="onScrollDown"
        badgeBackgroundColor={COLORS.secondary}
      >
        <NativeTabs.Trigger name="index">
          <Label>Accueil</Label>
          <Icon sf={{ default: "house", selected: "house.fill" }} />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="categories">
          <Label>Catégories</Label>
          <Icon sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }} />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="cart">
          <Label>Panier</Label>
          <Icon sf={{ default: "cart", selected: "cart.fill" }} />
          {cartCount > 0 && <Badge>{cartCount > 9 ? "9+" : String(cartCount)}</Badge>}
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="messages">
          <Label>Messages</Label>
          <Icon sf={{ default: "message", selected: "message.fill" }} />
          {unreadCount > 0 && <Badge>{unreadCount > 9 ? "9+" : String(unreadCount)}</Badge>}
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="profile">
          <Label>Profil</Label>
          <Icon sf={{ default: "person", selected: "person.fill" }} />
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  // Android: no native Liquid Glass, so approximate it with a frosted BlurView
  // behind a JS tab bar. The bar is absolutely positioned and transparent so
  // content scrolls underneath the blur.
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarStyle: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 78,
          paddingBottom: 12,
          paddingTop: 10,
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () => <GlassTabBarBackground />,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          letterSpacing: 0.5,
          fontFamily: "Inter_600SemiBold",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Accueil",
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "home" : "home-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: "Catégories",
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "view-grid" : "view-grid-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Panier",
          tabBarIcon: ({ color, focused }) => (
            <View>
              <MaterialCommunityIcons
                name={focused ? "shopping" : "shopping-outline"}
                size={24}
                color={color}
              />
              {cartCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{cartCount > 9 ? "9+" : cartCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, focused }) => (
            <View>
              <MaterialCommunityIcons
                name={focused ? "chat" : "chat-outline"}
                size={24}
                color={color}
              />
              {unreadCount > 0 && <View style={styles.dot} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? "account" : "account-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

function GlassTabBarBackground() {
  return (
    <BlurView
      intensity={40}
      tint="light"
      // Required for the blur to actually render on Android (otherwise it's
      // just a flat tint).
      experimentalBlurMethod="dimezisBlurView"
      style={StyleSheet.absoluteFill}
    >
      {/* Frosted overlay + hairline so the bar reads as glass over any content. */}
      <View style={styles.glassOverlay} />
    </BlurView>
  );
}

const styles = StyleSheet.create({
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0, 36, 68, 0.08)",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 10,
    color: "#fff",
    fontFamily: "Inter_700Bold",
  },
  dot: {
    position: "absolute",
    top: -2,
    right: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.secondary,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
});
