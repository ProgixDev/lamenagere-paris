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

/** A promo code the customer applied at checkout (validated server-side). */
export interface AppliedPromo {
  code: string;
  discountCents: number;
}

interface CheckoutStore {
  address: DeliveryAddress | null;
  territory: ShippingZone;
  shippingMethod: string;
  lastOrderNumber: string | null;
  /** Id of the order just placed, so the confirmation can show a real receipt. */
  lastOrderId: string | null;
  appliedPromo: AppliedPromo | null;
  setDeliveryAddress: (address: DeliveryAddress, territory: ShippingZone) => void;
  setShippingMethod: (method: string) => void;
  setLastOrderNumber: (orderNumber: string) => void;
  setLastOrderId: (orderId: string) => void;
  setAppliedPromo: (promo: AppliedPromo | null) => void;
  reset: () => void;
}

export const useCheckoutStore = create<CheckoutStore>((set) => ({
  address: null,
  territory: "metropole",
  shippingMethod: "standard",
  lastOrderNumber: null,
  lastOrderId: null,
  appliedPromo: null,
  setDeliveryAddress: (address, territory) => set({ address, territory }),
  setShippingMethod: (shippingMethod) => set({ shippingMethod }),
  setLastOrderNumber: (lastOrderNumber) => set({ lastOrderNumber }),
  setLastOrderId: (lastOrderId) => set({ lastOrderId }),
  setAppliedPromo: (appliedPromo) => set({ appliedPromo }),
  reset: () =>
    set({
      address: null,
      territory: "metropole",
      shippingMethod: "standard",
      lastOrderNumber: null,
      lastOrderId: null,
      appliedPromo: null,
    }),
}));
