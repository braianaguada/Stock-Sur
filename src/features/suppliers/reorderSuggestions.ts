import type { StockRow } from "@/features/stock/types";
import type {
  CatalogLine,
  SupplierReorderMatchReason,
  SupplierReorderSuggestion,
} from "@/features/suppliers/types";

const TARGET_COVER_DAYS = 30;

function normalizeExact(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("es-AR")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function uniqueIndex(rows: StockRow[], value: (row: StockRow) => string | null | undefined) {
  const grouped = new Map<string, StockRow[]>();
  for (const row of rows) {
    const key = normalizeExact(value(row));
    if (!key) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  return new Map(
    Array.from(grouped.entries())
      .filter(([, matches]) => matches.length === 1)
      .map(([key, matches]) => [key, matches[0]]),
  );
}

function resolveItem(
  line: CatalogLine,
  byId: Map<string, StockRow>,
  bySku: Map<string, StockRow>,
  byName: Map<string, StockRow>,
): { row: StockRow; reason: SupplierReorderMatchReason } | null {
  if (line.matched_item_id && byId.has(line.matched_item_id)) {
    return { row: byId.get(line.matched_item_id)!, reason: "CONFIRMED" };
  }

  const code = normalizeExact(line.supplier_code);
  if (code && bySku.has(code)) return { row: bySku.get(code)!, reason: "SKU" };

  for (const description of [line.product_name, line.raw_description]) {
    const name = normalizeExact(description);
    if (name && byName.has(name)) return { row: byName.get(name)!, reason: "EXACT_NAME" };
  }
  return null;
}

export function buildSupplierReorderSuggestions(
  lines: CatalogLine[],
  stockRows: StockRow[],
  targetCoverDays = TARGET_COVER_DAYS,
): SupplierReorderSuggestion[] {
  const byId = new Map(stockRows.map((row) => [row.item_id, row]));
  const bySku = uniqueIndex(stockRows, (row) => row.item_sku);
  const byName = uniqueIndex(stockRows, (row) => row.item_name);

  return lines.flatMap((line) => {
    const match = resolveItem(line, byId, bySku, byName);
    if (!match) return [];

    const row = match.row;
    const dailyOut = Math.max(
      row.avg_daily_out_365d,
      row.avg_daily_out_30d * 0.65 + row.avg_daily_out_90d * 0.35,
    );
    if (dailyOut <= 0) return [];

    const availableStock = Math.max(0, row.total);
    const daysOfCover = availableStock / dailyOut;
    const suggestedQuantity = Math.ceil(dailyOut * targetCoverDays - availableStock);
    if (suggestedQuantity <= 0) return [];

    return [{
      line,
      itemId: row.item_id,
      itemName: row.item_name,
      itemSku: row.item_sku,
      stock: row.total,
      averageMonthlyOut: dailyOut * 30,
      daysOfCover,
      suggestedQuantity,
      matchReason: match.reason,
    }];
  }).sort((left, right) =>
    left.daysOfCover - right.daysOfCover || right.averageMonthlyOut - left.averageMonthlyOut,
  );
}
