import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { persistStorage } from "../../lib/persist-storage";
import type { CampaignTarget } from "../../lib/notifications";

export interface InboxItem {
  id: string;
  title: string;
  body: string;
  target?: CampaignTarget;
  receivedAt: number;
  read: boolean;
}

const MAX_ITEMS = 50;

interface NotifInboxStore {
  items: InboxItem[];
  add: (item: Omit<InboxItem, "read">) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
}

/**
 * Local notification inbox. Incoming push/local notifications are captured here
 * (see the listener in app/_layout.tsx) so users get an in-app history with an
 * unread badge — the backend only sends outbound campaigns, it has no feed.
 */
export const useNotifInboxStore = create<NotifInboxStore>()(
  persist(
    (set, get) => ({
      items: [],

      add: (item) => {
        const { items } = get();
        // Dedupe by notification id (the same notification can arrive via both
        // the foreground "received" and the "tapped" listeners).
        if (items.some((i) => i.id === item.id)) return;
        set({ items: [{ ...item, read: false }, ...items].slice(0, MAX_ITEMS) });
      },

      markRead: (id) =>
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, read: true } : i)),
        })),

      markAllRead: () =>
        set((state) => ({
          items: state.items.map((i) => (i.read ? i : { ...i, read: true })),
        })),

      clear: () => set({ items: [] }),
    }),
    {
      name: "notif-inbox-storage",
      storage: createJSONStorage(() => persistStorage),
    },
  ),
);

/** Selector helper for the unread count (drives the bell badge). */
export const selectUnreadCount = (s: NotifInboxStore) =>
  s.items.reduce((n, i) => (i.read ? n : n + 1), 0);
