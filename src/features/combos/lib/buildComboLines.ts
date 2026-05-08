import type { LineDraft, PriceListItemRow } from "@/features/documents/types";

type ComboLineInput = {
  item_id: string;
  quantity: number;
  line_order: number;
  notes?: string | null;
};

type BuildComboLinesParams = {
  comboName: string;
  lines: ComboLineInput[];
  availableItems: Array<{ id: string; sku: string; name: string; unit?: string | null; brand?: string | null; model?: string | null; attributes?: string | null }>;
  priceByItem: Map<string, number>;
  priceListItemByItemId: Map<string, PriceListItemRow>;
  applyRounding: (price: number) => number;
  userId?: string;
  nowIso: string;
};

const EMPTY_LINE = (itemId: string, quantity: number, userId?: string, nowIso?: string): LineDraft => ({
  item_id: itemId,
  sku_snapshot: "",
  description: "",
  unit: "un",
  quantity,
  unit_price: 0,
  pricing_mode: "LIST_PRICE",
  suggested_unit_price: 0,
  base_cost_snapshot: null,
  list_flete_pct_snapshot: null,
  list_utilidad_pct_snapshot: null,
  list_impuesto_pct_snapshot: null,
  manual_margin_pct: null,
  price_overridden_by: userId ?? null,
  price_overridden_at: nowIso ?? null,
});

export function buildComboLines({ comboName, lines, availableItems, priceByItem, priceListItemByItemId, applyRounding, userId, nowIso }: BuildComboLinesParams) {
  const itemsById = new Map(availableItems.map((item) => [item.id, item]));
  return lines.map((line) => {
    const item = itemsById.get(line.item_id);
    if (!item) throw new Error(`No se encontro el item ${line.item_id} para el combo ${comboName}`);
    const priceRow = priceListItemByItemId.get(item.id);
    const suggestedUnitPrice = priceByItem.get(item.id) ?? (Number(priceRow?.calculated_price) || 0);
    const unitPrice = applyRounding(suggestedUnitPrice);
    return {
      ...EMPTY_LINE(item.id, line.quantity, userId, nowIso),
      sku_snapshot: item.sku,
      description: item.name,
      unit: item.unit ?? "un",
      quantity: line.quantity,
      unit_price: unitPrice,
      suggested_unit_price: suggestedUnitPrice,
      base_cost_snapshot: priceRow ? Number(priceRow.base_cost) || 0 : null,
      list_flete_pct_snapshot: priceRow?.flete_pct !== null && priceRow?.flete_pct !== undefined ? Number(priceRow.flete_pct) : null,
      list_utilidad_pct_snapshot: priceRow?.utilidad_pct !== null && priceRow?.utilidad_pct !== undefined ? Number(priceRow.utilidad_pct) : null,
      list_impuesto_pct_snapshot: priceRow?.impuesto_pct !== null && priceRow?.impuesto_pct !== undefined ? Number(priceRow.impuesto_pct) : null,
      price_overridden_by: null,
      price_overridden_at: null,
    } satisfies LineDraft;
  });
}
