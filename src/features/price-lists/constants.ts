import type { PriceListFormState } from "@/features/price-lists/types";

export const DEFAULT_PRICE_LIST_FORM: PriceListFormState = {
  name: "",
  description: "",
  flete_pct: "10",
  utilidad_pct: "5",
  impuesto_pct: "21",
};

export const PRICE_LIST_STATUS_LABEL: Record<"PENDING" | "UPDATED", string> = {
  PENDING: "Pendiente",
  UPDATED: "Actualizada",
};

