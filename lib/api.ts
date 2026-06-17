import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "./constants";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync("auth_token");
      await SecureStore.deleteItemAsync("user");
    }

    // No `response` means the request never reached the server (server down,
    // wrong host/IP, no internet) or it timed out. Surface that distinctly so
    // the user isn't told it's a credentials/Google problem.
    const isTimeout = error.code === "ECONNABORTED";
    const isNetworkError = !error.response;

    let message: string;
    if (isTimeout) {
      message = "Le serveur met trop de temps à répondre. Réessayez.";
    } else if (isNetworkError) {
      message =
        "Impossible de joindre le serveur. Vérifiez votre connexion internet.";
    } else {
      message = error.response?.data?.message || "Une erreur s’est produite";
    }

    return Promise.reject({
      message,
      status: error.response?.status,
      isNetworkError: isTimeout || isNetworkError,
    });
  },
);
