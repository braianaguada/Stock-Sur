export type PriceListStatus = "PENDING" | "UPDATED";

export interface BasePriceRow {
  item_id: string;
  sku: string | null;
  name: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  unit: string | null;
  previous_base_cost: number | null;
  base_cost: number;
  cost_variation_pct: number | null;
  updated_at: string | null;
  updated_by: string | null;
}

export interface PriceListSummary {
  id: string;
  name: string;
  description: string | null;
  flete_pct: number;
  utilidad_pct: number;
  impuesto_pct: number;
  status: PriceListStatus;
  last_recalculated_at: string | null;
  last_recalculated_by: string | null;
  updated_at: string;
  updated_by: string | null;
  created_at: string;
  created_by: string | null;
  pending_items_count: number;
  total_items_count: number;
}

export interface PriceListProductRow {
  item_id: string;
  sku: string | null;
  name: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  unit: string | null;
  previous_base_cost: number | null;
  base_cost: number;
  cost_variation_pct: number | null;
  calculated_price: number;
  needs_recalculation: boolean;
  last_calculated_at: string | null;
  last_calculated_by: string | null;
}

export interface PriceListHistoryRow {
  id: string;
  event_type: string;
  affected_items_count: number;
  details: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
}

export interface PriceListFormState {
  name: string;
  description: string;
  flete_pct: string;
  utilidad_pct: string;
  impuesto_pct: string;
}
