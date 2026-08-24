import { Platform } from "react-native";
import Constants from "expo-constants";
import { apiClient } from "../../lib/api";

/** Réponse du verrou de version (GET /app-version). */
export interface AppVersionGate {
  updateRequired: boolean;
  minVersion: string | null;
  installedVersion: string | null;
  storeUrl: string | null;
  message: string | null;
  maintenanceMode: boolean;
}

/**
 * Version du binaire installé.
 *
 * `expoConfig.version` vient de app.json embarqué dans le bundle JS. Comme
 * `runtimeVersion.policy` vaut `appVersion`, une mise à jour OTA n'atteint que
 * les binaires de la même version — la valeur correspond donc toujours à
 * l'installation réelle du store, sans dépendre d'un module natif
 * (expo-application), ce qui garde ce verrou déployable en OTA.
 */
export const INSTALLED_APP_VERSION: string | null =
  Constants.expoConfig?.version ?? null;

/** Lien du store en secours si l'admin n'en a pas configuré. */
export const FALLBACK_STORE_URL =
  Platform.OS === "ios"
    ? "https://apps.apple.com/app/id6794943782"
    : "https://play.google.com/store/apps/details?id=com.progix.lamenagereparis";

export const getAppVersionGateApi = async (): Promise<AppVersionGate> => {
  const { data } = await apiClient.get<AppVersionGate>("/app-version", {
    params: {
      platform: Platform.OS,
      version: INSTALLED_APP_VERSION,
    },
  });
  return data;
};
