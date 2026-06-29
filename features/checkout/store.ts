import { create } from "zustand";
import type { ShippingZone } from "../../lib/types";

export interface DeliveryAddress {
  firstName: string;
  lastName: string;
  street: string;
  postalCode: string;
  city: string;
  phone?: string;
}

interface CheckoutStore {
  address: DeliveryAddress | null;
  territory: ShippingZone;
  shippingMethod: string;
  lastOrderNumber: string | null;
  setDeliveryAddress: (address: DeliveryAddress, territory: ShippingZone) => void;
  setShippingMethod: (method: string) => void;
  setLastOrderNumber: (orderNumber: string) => void;
  reset: () => void;
}

export const useCheckoutStore = create<CheckoutStore>((set) => ({
  address: null,
  territory: "metropole",
  shippingMethod: "standard",
  lastOrderNumber: null,
  setDeliveryAddress: (address, territory) => set({ address, territory }),
  setShippingMethod: (shippingMethod) => set({ shippingMethod }),
  setLastOrderNumber: (lastOrderNumber) => set({ lastOrderNumber }),
  reset: () =>
    set({
      address: null,
      territory: "metropole",
      shippingMethod: "standard",
      lastOrderNumber: null,
    }),
}));
