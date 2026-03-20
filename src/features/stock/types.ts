export type MovementType = "IN" | "OUT" | "ADJUSTMENT";
export type StockHealth = "GREEN" | "YELLOW" | "RED" | "GRAY";
export type DemandProfile = "LOW" | "MEDIUM" | "HIGH";

export interface StockRow {
  item_id: string;
  item_name: string;
  item_sku: string;
  item_unit: string;
  total: number;
  avg_daily_out_30d: number;
  avg_daily_out_90d: number;
  avg_daily_out_365d: number;
  demand_daily: number;
  days_of_cover: number | null;
  months_of_cover_low_rotation: number | null;
  health: StockHealth;
  low_rotation: boolean;
  demand_profile: DemandProfile;
  demand_monthly_estimate: number | null;
}

export interface Movement {
  id: string;
  item_id: string;
  type: MovementType;
  quantity: number;
  reference: string | null;
  created_by: string | null;
  created_by_name?: string;
  created_at: string;
  items?: { name: string; sku: string } | null;
}
