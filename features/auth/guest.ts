import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { persistStorage } from "../../lib/persist-storage";

/**
 * "Ghost" / guest mode. Lets a visitor browse the catalogue and fill a cart
 * without an account. No personal data is collected while in this mode (GDPR
 * data-minimisation) — checkout requires authentication, at which point the
 * usual consent / terms apply. The flag is persisted so a guest stays a guest
 * across launches until they sign in or explicitly leave.
 */
interface GuestStore {
  isGuest: boolean;
  /** True once the persisted value has rehydrated (so routing can wait for it). */
  hydrated: boolean;
  enterGuest: () => void;
  exitGuest: () => void;
}

export const useGuestStore = create<GuestStore>()(
  persist(
    (set) => ({
      isGuest: false,
      hydrated: false,
      enterGuest: () => set({ isGuest: true }),
      exitGuest: () => set({ isGuest: false }),
    }),
    {
      name: "guest-mode-storage",
      storage: createJSONStorage(() => persistStorage),
      partialize: (s) => ({ isGuest: s.isGuest }),
      onRehydrateStorage: () => () => {
        useGuestStore.setState({ hydrated: true });
      },
    },
  ),
);
