import type { AreaDimensions } from "../../lib/area-formulas";
import type { Order, ItemConfiguration } from "../../lib/types";

export interface CreateOrderPayload {
  items: {
    productId: string;
    quantity: number;
    customDimensions?: AreaDimensions;
    qualityTier?: string;
    configuration?: ItemConfiguration;
    quoteId?: string;
  }[];
  shippingAddressId?: string;
  shippingAddress?: {
    firstName: string;
    lastName: string;
    street: string;
    postalCode: string;
    city: string;
    phone?: string;
    territory?: string;
  };
  shippingMethod: string;
  territory?: string;
  promoCode?: string;
  customerNote?: string;
  customerAttachments?: { url: string; type: "image" | "video" }[];
}

export interface OrdersState {
  orders: Order[];
  isLoading: boolean;
  error: string | null;
}

export interface TrackingInfo {
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
  estimatedDelivery: string;
}
