import { Stack } from "expo-router";

export default function MainLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="categories/[id]" />
      <Stack.Screen name="products/[id]" />
      <Stack.Screen name="search/index" />
      <Stack.Screen name="checkout/index" />
      <Stack.Screen name="checkout/shipping" />
      <Stack.Screen name="checkout/payment" />
      <Stack.Screen name="checkout/confirmation" />
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
