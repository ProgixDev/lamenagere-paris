import { Stack } from "expo-router";

export default function MainLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Smooth horizontal push for detail screens, with edge-swipe back.
        animation: "slide_from_right",
        animationDuration: 280,
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="categories/[id]" />
      <Stack.Screen name="products/[id]" />
      {/* Search and checkout feel more like overlays → present from the bottom. */}
      <Stack.Screen name="search/index" options={{ animation: "slide_from_bottom" }} />
      <Stack.Screen name="checkout/index" options={{ animation: "slide_from_bottom" }} />
      <Stack.Screen name="checkout/shipping" />
      <Stack.Screen name="checkout/payment" />
      <Stack.Screen name="checkout/confirmation" options={{ animation: "fade", gestureEnabled: false }} />
      <Stack.Screen name="orders/index" />
      <Stack.Screen name="orders/[id]" />
      <Stack.Screen name="messages/[id]" />
      <Stack.Screen name="favorites" />
      <Stack.Screen name="addresses" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="about" />
      <Stack.Screen name="support" />
      <Stack.Screen name="legal/terms" />
      <Stack.Screen name="legal/privacy" />
      <Stack.Screen name="legal/cgv" />
    </Stack>
  );
}
