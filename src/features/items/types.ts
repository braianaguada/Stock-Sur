export interface Item {
  id: string;
  sku: string;
  name: string;
  supplier: string | null;
  supplier_id?: string | null;
  description?: string | null;
  technical_notes?: string | null;
  structured_attributes?: Record<string, string>;
  weight?: number | null;
  weight_unit?: string;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  dimension_unit?: string;
  brand: string | null;
  model: string | null;
  attributes: string | null;
  unit: string;
  category: string | null;
  demand_profile: "LOW" | "MEDIUM" | "HIGH";
  demand_monthly_estimate: number | null;
  is_active: boolean;
}

export interface ItemAlias {
  id: string;
  item_id: string;
  alias: string;
  is_supplier_code: boolean;
  supplier_id?: string | null;
}

export interface ItemOperationalMeta {
  stock: number | null;
  base_cost: number | null;
  main_price: number | null;
  main_price_original: number | null;
  main_price_list_name: string | null;
  margin_pct: number | null;
}
