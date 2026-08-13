import type { AreaDimensions } from "../../lib/area-formulas";
import type { CartItem, Product } from "../../lib/types";

export interface CartState {
  items: CartItem[];
  lastUpdated: number;
}

export interface CartActions {
  addItem: (
    product: Product,
    quantity?: number,
    customDimensions?: AreaDimensions,
    qualityTier?: string,
  ) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
}

export interface CartComputed {
  itemCount: number;
  subtotal: number;
}
