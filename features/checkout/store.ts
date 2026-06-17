import { create } from "zustand";
import type { ShippingZone } from "../../lib/types";

interface CheckoutStore {
  shippingAddressId: string | null;
  territory: ShippingZone;
  shippingMethod: string;
  lastOrderNumber: string | null;
  setAddress: (id: string, territory: ShippingZone) => void;
  setShippingMethod: (method: string) => void;
  setLastOrderNumber: (orderNumber: string) => void;
  reset: () => void;
}

export const useCheckoutStore = create<CheckoutStore>((set) => ({
  shippingAddressId: null,
  territory: "metropole",
  shippingMethod: "standard",
  lastOrderNumber: null,
  setAddress: (shippingAddressId, territory) =>
    set({ shippingAddressId, territory }),
  setShippingMethod: (shippingMethod) => set({ shippingMethod }),
  setLastOrderNumber: (lastOrderNumber) => set({ lastOrderNumber }),
  reset: () =>
    set({
      shippingAddressId: null,
      territory: "metropole",
      shippingMethod: "standard",
      lastOrderNumber: null,
    }),
}));
