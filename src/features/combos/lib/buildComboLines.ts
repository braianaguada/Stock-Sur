import type { LineDraft, PriceListItemRow } from "@/features/documents/types";
import { buildDocumentLineFromItem, type DocumentLineItem } from "@/features/documents/lib/buildDocumentLineFromItem";

type ComboLineInput = {
  item_id: string;
  quantity: number;
  line_order: number;
  notes?: string | null;
};

type BuildComboLinesParams = {
  comboName: string;
  lines: ComboLineInput[];
  multiplier?: number;
  availableItems: DocumentLineItem[];
  priceByItem: Map<string, number>;
  priceListItemByItemId: Map<string, PriceListItemRow>;
  applyRounding: (price: number) => number;
  userId?: string;
  nowIso: string;
};

export function buildComboLines({ comboName, lines, multiplier = 1, availableItems, priceByItem, priceListItemByItemId, applyRounding }: BuildComboLinesParams) {
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    throw new Error(`El multiplicador del combo ${comboName} debe ser mayor a cero`);
  }
  const itemsById = new Map(availableItems.map((item) => [item.id, item]));
  return lines.map((line) => {
    const item = itemsById.get(line.item_id);
    if (!item) throw new Error(`No se encontro el item ${line.item_id} para el combo ${comboName}`);
    const expandedQuantity = line.quantity * multiplier;
    return buildDocumentLineFromItem({
      item,
      quantity: expandedQuantity,
      priceListRow: priceListItemByItemId.get(item.id),
      priceByItem,
      applyRounding,
      forceListPrice: true,
    }) satisfies LineDraft;
  });
}
