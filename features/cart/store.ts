import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { persistStorage } from "../../lib/persist-storage";
import type { Product, CartItem } from "../../lib/types";
import { computeConfiguredPrice } from "../../lib/pricing";

interface CartStore {
  items: CartItem[];
  lastUpdated: number;
  addItem: (
    product: Product,
    quantity?: number,
    customDimensions?: { width: number; height: number },
    openingType?: string,
  ) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      lastUpdated: Date.now(),

      addItem: (product, quantity = 1, customDimensions, openingType) => {
        // Made-to-measure products (priced per m²) can't be added without
        // dimensions — there'd be no price. The customer must configure them
        // on the product page first.
        const needsDimensions =
          product.priceMode === "per_sqm" ||
          product.productType === "configurable";
        if (needsDimensions && !customDimensions) {
          if (__DEV__) {
            console.warn(
              `[cart] refused to add "${product.name}" without dimensions — configure it on the product page`,
            );
          }
          return;
        }
        const { items } = get();
        // A made-to-measure line (custom dimensions or chosen opening type) is
        // unique — never merge it into another line. Plain products still merge.
        const isConfigured = !!customDimensions || !!openingType;
        const existingIndex = isConfigured
          ? -1
          : items.findIndex((item) => item.product.id === product.id);

        const calculatedPrice =
          computeConfiguredPrice(product, customDimensions, openingType) ??
          product.price;

        if (existingIndex >= 0) {
          const updated = [...items];
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: updated[existingIndex].quantity + quantity,
          };
          set({ items: updated, lastUpdated: Date.now() });
        } else {
          const newItem: CartItem = {
            id: `${product.id}-${Date.now()}`,
            product,
            quantity,
            customDimensions,
            openingType,
            calculatedPrice,
          };
          set({ items: [...items, newItem], lastUpdated: Date.now() });
        }
      },

      removeItem: (itemId) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== itemId),
          lastUpdated: Date.now(),
        }));
      },

      updateQuantity: (itemId, quantity) => {
        if (quantity < 1) return;
        set((state) => ({
          items: state.items.map((item) =>
            item.id === itemId ? { ...item, quantity } : item,
          ),
          lastUpdated: Date.now(),
        }));
      },

      clearCart: () => set({ items: [], lastUpdated: Date.now() }),
    }),
    {
      name: "cart-storage",
      storage: createJSONStorage(() => persistStorage),
    },
  ),
);

export const useCartItemCount = () =>
  useCartStore((state) =>
    state.items.reduce((sum, item) => sum + item.quantity, 0),
  );

export const useCartSubtotal = () =>
  useCartStore((state) =>
    state.items.reduce(
      (sum, item) => sum + (item.calculatedPrice || item.product.price || 0) * item.quantity,
      0,
    ),
  );
