import { apiClient } from "../../lib/api";
import type { User } from "../../lib/types";
import type { AuthResponse, LoginPayload, RegisterPayload } from "./types";

export const loginApi = async (
  payload: LoginPayload,
): Promise<AuthResponse> => {
  const { data } = await apiClient.post<AuthResponse>("/auth/login", payload);
  return data;
};

export const registerApi = async (
  payload: RegisterPayload,
): Promise<AuthResponse> => {
  const { data } = await apiClient.post<AuthResponse>(
    "/auth/register",
    payload,
  );
  return data;
};

export const logoutApi = async (): Promise<void> => {
  await apiClient.post("/auth/logout");
};

export const forgotPasswordApi = async (
  email: string,
): Promise<{ success: boolean }> => {
  const { data } = await apiClient.post("/auth/forgot-password", { email });
  return data;
};

export const getProfileApi = async (): Promise<User> => {
  const { data } = await apiClient.get<User>("/auth/profile");
  return data;
};

export const updateProfileApi = async (
  payload: Partial<User>,
): Promise<User> => {
  const { data } = await apiClient.put<User>("/auth/profile", payload);
  return data;
};
