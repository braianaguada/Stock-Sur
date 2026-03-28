export interface Item {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  model: string | null;
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
}
