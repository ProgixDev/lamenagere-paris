import { apiClient } from "../../lib/api";
import type { AppPopup } from "../../lib/types";

/** Active marketing pop-ups shown when the app opens. */
export const getPopupsApi = async (): Promise<AppPopup[]> => {
  const { data } = await apiClient.get<AppPopup[]>("/popups");
  return data;
};
