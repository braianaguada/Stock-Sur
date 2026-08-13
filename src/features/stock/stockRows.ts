import type {
  DemandProfile,
  MovementType,
  StockHealth,
  StockRow,
} from "@/features/stock/types";

export type StockItemSource = {
  id: string;
  name: string;
  sku: string;
  unit: string | null;
  supplier: string | null;
  brand: string | null;
  model: string | null;
  attributes: string | null;
  category: string | null;
  demand_profile: DemandProfile | null;
  demand_monthly_estimate: number | null;
};

export type StockMovementSource = {
  item_id: string;
  type: MovementType;
  quantity: number;
  created_at: string;
  items?: {
    name?: string | null;
    sku?: string | null;
    unit?: string | null;
    brand?: string | null;
    model?: string | null;
    attributes?: string | null;
    demand_profile?: DemandProfile | null;
    demand_monthly_estimate?: number | null;
  } | null;
};

type AccumulatedStockRow = StockRow & {
  out_30d: number;
  out_90d: number;
  out_365d: number;
  out_month_buckets_12m: number[];
};

function createAccumulatedRow(
  itemId: string,
  item: Partial<StockItemSource>,
): AccumulatedStockRow {
  return {
    item_id: itemId,
    item_name: item.name ?? "",
    item_sku: item.sku ?? "",
    item_unit: item.unit ?? "",
    item_supplier: item.supplier ?? null,
    item_brand: item.brand ?? null,
    item_model: item.model ?? null,
    item_attributes: item.attributes ?? null,
    item_category: item.category ?? null,
    total: 0,
    avg_daily_out_30d: 0,
    avg_daily_out_90d: 0,
    avg_daily_out_365d: 0,
    demand_daily: 0,
    days_of_cover: null,
    months_of_cover_low_rotation: null,
    health: "GRAY",
    low_rotation: false,
    demand_profile: item.demand_profile ?? "LOW",
    demand_monthly_estimate: item.demand_monthly_estimate ?? null,
    out_30d: 0,
    out_90d: 0,
    out_365d: 0,
    out_month_buckets_12m: Array.from({ length: 12 }, () => 0),
  };
}

function calculateHealth(row: AccumulatedStockRow, daysOfCover: number | null): StockHealth {
  if (row.total <= 0) return "RED";
  if (row.demand_profile === "LOW") return row.total <= 2 ? "YELLOW" : "GREEN";

  const redThreshold = row.demand_profile === "HIGH" ? 15 : 10;
  const yellowThreshold = row.demand_profile === "HIGH" ? 30 : 20;
  if (daysOfCover !== null && daysOfCover < redThreshold) return "RED";
  if (daysOfCover !== null && daysOfCover < yellowThreshold) return "YELLOW";
  return "GREEN";
}

export function buildStockRows(
  items: StockItemSource[],
  movements: StockMovementSource[],
  nowMs = Date.now(),
): StockRow[] {
  const last30DaysTs = nowMs - 30 * 24 * 60 * 60 * 1000;
  const last90DaysTs = nowMs - 90 * 24 * 60 * 60 * 1000;
  const last365DaysTs = nowMs - 365 * 24 * 60 * 60 * 1000;
  const now = new Date(nowMs);
  const rowsByItem = new Map<string, AccumulatedStockRow>();

  for (const item of items) {
    rowsByItem.set(item.id, createAccumulatedRow(item.id, item));
  }

  for (const movement of movements) {
    const row =
      rowsByItem.get(movement.item_id) ??
      createAccumulatedRow(movement.item_id, movement.items ?? {});
    rowsByItem.set(movement.item_id, row);

    row.item_name = movement.items?.name ?? row.item_name;
    row.item_sku = movement.items?.sku ?? row.item_sku;
    row.item_unit = movement.items?.unit ?? row.item_unit;
    row.item_brand = movement.items?.brand ?? row.item_brand;
    row.item_model = movement.items?.model ?? row.item_model;
    row.item_attributes = movement.items?.attributes ?? row.item_attributes;
    row.demand_profile = movement.items?.demand_profile ?? row.demand_profile;
    row.demand_monthly_estimate =
      movement.items?.demand_monthly_estimate ?? row.demand_monthly_estimate;

    const quantity = Number(movement.quantity);
    row.total += movement.type === "OUT" ? -quantity : quantity;

    if (movement.type !== "OUT") continue;
    if (new Date(movement.created_at).getTime() >= last30DaysTs) {
      row.out_30d += Math.max(0, quantity);
    }
    if (new Date(movement.created_at).getTime() >= last90DaysTs) {
      row.out_90d += Math.max(0, quantity);
    }
    if (new Date(movement.created_at).getTime() < last365DaysTs) continue;

    const outQty = Math.max(0, quantity);
    const moveDate = new Date(movement.created_at);
    row.out_365d += outQty;
    const monthDiff =
      (now.getFullYear() - moveDate.getFullYear()) * 12 +
      (now.getMonth() - moveDate.getMonth());
    if (monthDiff >= 0 && monthDiff < 12) {
      row.out_month_buckets_12m[monthDiff] += outQty;
    }
  }

  return Array.from(rowsByItem.values())
    .map((row): StockRow => {
      const avgDailyOut30 = row.out_30d / 30;
      const avgDailyOut90 = row.out_90d / 90;
      const avgDailyOut365 = row.out_365d / 365;
      const demandDailyAuto = Math.max(
        avgDailyOut365,
        avgDailyOut30 * 0.5 + avgDailyOut90 * 0.3 + avgDailyOut365 * 0.2,
      );
      const demandDaily = demandDailyAuto;
      const monthlyDemand365 = row.out_365d / 12;
      const monthlyDemand90 = row.out_90d / 3;
      const daysOfCover = demandDaily > 0 ? row.total / demandDaily : null;
      const sortedMonthlyDemand = [...row.out_month_buckets_12m].sort((a, b) => a - b);
      const lowSeasonIndex = Math.floor((sortedMonthlyDemand.length - 1) * 0.35);
      const lowSeasonMonthlyDemand = sortedMonthlyDemand[lowSeasonIndex] ?? 0;
      const lowRotationCandidates = [
        lowSeasonMonthlyDemand,
        monthlyDemand365,
        monthlyDemand90,
      ].filter((value) => value > 0);
      const monthlyDemandLowRotationAuto =
        lowRotationCandidates.length > 0 ? Math.min(...lowRotationCandidates) : 0;
      const monthlyDemandLowRotation = monthlyDemandLowRotationAuto;

      return {
        item_id: row.item_id,
        item_name: row.item_name,
        item_sku: row.item_sku,
        item_unit: row.item_unit,
        item_supplier: row.item_supplier,
        item_brand: row.item_brand,
        item_model: row.item_model,
        item_attributes: row.item_attributes,
        item_category: row.item_category,
        total: row.total,
        avg_daily_out_30d: avgDailyOut30,
        avg_daily_out_90d: avgDailyOut90,
        avg_daily_out_365d: avgDailyOut365,
        demand_daily: demandDaily,
        days_of_cover: daysOfCover,
        months_of_cover_low_rotation:
          monthlyDemandLowRotation > 0 ? row.total / monthlyDemandLowRotation : null,
        health: calculateHealth(row, daysOfCover),
        low_rotation: row.demand_profile === "LOW",
        demand_profile: row.demand_profile,
        demand_monthly_estimate: row.demand_monthly_estimate,
      };
    })
    .sort((a, b) => a.item_name.localeCompare(b.item_name));
}
