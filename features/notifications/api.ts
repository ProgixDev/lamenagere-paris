import { Platform } from "react-native";
import { apiClient } from "../../lib/api";

/**
 * Registers this device's Expo push token with the backend so it can receive
 * campaign + transactional notifications. Called after authentication.
 */
export async function registerDeviceApi(token: string): Promise<void> {
  await apiClient.post("/notifications/register-device", {
    token,
    platform: Platform.OS === "ios" ? "ios" : "android",
    provider: "expo",
  });
}

export async function unregisterDeviceApi(token: string): Promise<void> {
  await apiClient.post("/notifications/unregister-device", { token });
}
