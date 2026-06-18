import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { persistStorage } from "../../lib/persist-storage";

interface NotifPrefStore {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
}

/** Persisted push-notification preference (drives device register/unregister). */
export const useNotifPrefStore = create<NotifPrefStore>()(
  persist(
    (set) => ({
      enabled: true,
      setEnabled: (v) => set({ enabled: v }),
    }),
    {
      name: "notif-pref-storage",
      storage: createJSONStorage(() => persistStorage),
    },
  ),
);
