import type { PriceList } from "@/features/price-lists/types";

export const DEFAULT_PRICE_LIST_FORM = {
  name: "",
  flete_pct: "10",
  utilidad_pct: "55",
  impuesto_pct: "21",
  round_mode: "none" as PriceList["round_mode"],
  round_to: "1",
};
