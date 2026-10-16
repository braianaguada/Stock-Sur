import type { StockInsight } from "./insights";
import type { StockRow } from "./types";

const actions: Record<StockInsight["kind"], string> = {
  STOCKOUT: "Reponer",
  LOW_COVERAGE: "Revisar reposición",
  DEMAND_SPIKE: "Revisar demanda",
  OVERSTOCK: "Reducir compras",
  DORMANT_STOCK: "Revisar continuidad",
  NO_SIGNAL: "Revisar demanda estimada",
};

// Presentation only: preserve the priority and membership of the existing alerts.
export function groupStockAlerts(alerts: StockInsight[], rows: StockRow[]) {
  const items = new Map(rows.map(row => [row.item_id, row]));
  const groups = new Map<StockInsight["kind"], {
    kind: StockInsight["kind"];
    tone: StockInsight["tone"];
    action: string;
    products: { id: string; name: string; detail: string; sku: string }[];
  }>();
  for (const alert of alerts) {
    const row = items.get(alert.itemId);
    const group = groups.get(alert.kind) ?? {
      kind: alert.kind, tone: alert.tone, action: actions[alert.kind], products: [],
    };
    const name = row?.item_name || alert.itemName;
    const detail = [...new Set([row?.item_brand, row?.item_model, row?.item_attributes]
      .map(value => value?.trim()).filter((value): value is string => Boolean(value) && value !== name))].join(" · ");
    group.products.push({ id: alert.id, name, detail, sku: row?.item_sku ?? "" });
    groups.set(alert.kind, group);
  }
  return [...groups.values()];
}
