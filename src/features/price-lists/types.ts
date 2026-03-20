export interface PriceList {
  id: string;
  name: string;
  created_at: string;
  flete_pct: number;
  utilidad_pct: number;
  impuesto_pct: number;
  round_mode: "none" | "integer" | "tens" | "hundreds" | "x99";
  round_to: number;
}

export interface CatalogItem {
  id: string;
  sku: string | null;
  name: string;
  unit: string | null;
}

export interface PriceListItem {
  price_list_id: string;
  item_id: string;
  is_active: boolean;
  base_cost: number;
  flete_pct: number | null;
  utilidad_pct: number | null;
  impuesto_pct: number | null;
  final_price_override: number | null;
  items: CatalogItem | null;
}

export type LineDraft = {
  base_cost: string;
  flete_pct: string;
  utilidad_pct: string;
  impuesto_pct: string;
  final_price_override: string;
};

export type ListConfigDraft = {
  flete_pct: string;
  utilidad_pct: string;
  impuesto_pct: string;
  round_mode: PriceList["round_mode"];
  round_to: string;
};
