import { createContext, useContext } from "react";
import type { DisplayCurrency, SupplierCartItem } from "../pricing";

interface PurchasingContext {
  items: SupplierCartItem[];
  addItem: (item: SupplierCartItem) => void;
  open: () => void;
  currency: DisplayCurrency;
  setCurrency: (currency: DisplayCurrency) => void;
  total: string;
}

export const SupplierPurchasingContext = createContext<PurchasingContext | null>(null);
export const useSupplierPurchasing = () => useContext(SupplierPurchasingContext);
