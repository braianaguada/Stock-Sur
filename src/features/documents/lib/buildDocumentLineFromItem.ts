import { buildItemDisplayName } from "@/lib/item-display";
import type { LineDraft, LinePricingMode, PriceListItemRow } from "../types";
import { calculatePriceFromCostBase } from "../utils";

export type DocumentLineItem = {
  id: string;
  sku: string;
  name: string;
  unit?: string | null;
  brand?: string | null;
  model?: string | null;
  attributes?: string | null;
};

type BuildDocumentLineFromItemParams = {
  item: DocumentLineItem;
  quantity: number;
  currentLine?: LineDraft;
  priceListRow?: PriceListItemRow;
  priceByItem?: Map<string, number>;
  applyRounding: (price: number) => number;
  forceListPrice?: boolean;
};

const EMPTY_ITEM_LINE = (item: DocumentLineItem, quantity: number): LineDraft => ({
  item_id: item.id,
  sku_snapshot: item.sku,
  description: buildItemDisplayName({
    name: item.name,
    brand: item.brand,
    model: item.model,
    attributes: item.attributes,
  }),
  unit: item.unit || "un",
  quantity,
  unit_price: 0,
  pricing_mode: "MANUAL_PRICE",
  suggested_unit_price: 0,
  base_cost_snapshot: null,
  list_flete_pct_snapshot: null,
  list_utilidad_pct_snapshot: null,
  list_impuesto_pct_snapshot: null,
  manual_margin_pct: null,
  price_overridden_by: null,
  price_overridden_at: null,
  unrounded_suggested_unit_price: null,
});

export function buildDocumentLineFromItem({
  item,
  quantity,
  currentLine,
  priceListRow,
  priceByItem = new Map(),
  applyRounding,
  forceListPrice = false,
}: BuildDocumentLineFromItemParams): LineDraft {
  const baseLine: LineDraft = {
    ...EMPTY_ITEM_LINE(item, quantity),
    ...currentLine,
    item_id: item.id,
    sku_snapshot: item.sku,
    description: buildItemDisplayName({
      name: item.name,
      brand: item.brand,
      model: item.model,
      attributes: item.attributes,
    }),
    unit: item.unit || "un",
    quantity,
  };

  if (!priceListRow) {
    return {
      ...baseLine,
      pricing_mode: "MANUAL_PRICE",
      suggested_unit_price: baseLine.unit_price,
      base_cost_snapshot: null,
      list_flete_pct_snapshot: null,
      list_utilidad_pct_snapshot: null,
      list_impuesto_pct_snapshot: null,
      manual_margin_pct: null,
      price_overridden_by: null,
      price_overridden_at: null,
      unrounded_suggested_unit_price: null,
    };
  }

  const unroundedSuggestedUnitPrice =
    priceByItem.get(priceListRow.item_id) ?? (Number(priceListRow.calculated_price) || 0);
  const suggestedUnitPrice = applyRounding(unroundedSuggestedUnitPrice);
  const baseCost = Number(priceListRow.base_cost) || 0;
  const listFlete = priceListRow.flete_pct !== null ? Number(priceListRow.flete_pct) : null;
  const listUtilidad = priceListRow.utilidad_pct !== null ? Number(priceListRow.utilidad_pct) : null;
  const listImpuesto = priceListRow.impuesto_pct !== null ? Number(priceListRow.impuesto_pct) : null;
  const nextMode: LinePricingMode = forceListPrice
    ? "LIST_PRICE"
    : baseLine.pricing_mode === "MANUAL_MARGIN" || baseLine.pricing_mode === "MANUAL_PRICE"
      ? baseLine.pricing_mode
      : "LIST_PRICE";

  const nextLine: LineDraft = {
    ...baseLine,
    pricing_mode: nextMode,
    suggested_unit_price: suggestedUnitPrice,
    unrounded_suggested_unit_price:
      suggestedUnitPrice !== unroundedSuggestedUnitPrice ? unroundedSuggestedUnitPrice : null,
    base_cost_snapshot: baseCost,
    list_flete_pct_snapshot: listFlete,
    list_utilidad_pct_snapshot: listUtilidad,
    list_impuesto_pct_snapshot: listImpuesto,
  };

  if (nextMode === "LIST_PRICE") {
    return {
      ...nextLine,
      unit_price: suggestedUnitPrice,
      manual_margin_pct: null,
      price_overridden_by: null,
      price_overridden_at: null,
    };
  }

  if (nextMode === "MANUAL_MARGIN") {
    const marginPct = nextLine.manual_margin_pct ?? listUtilidad ?? 0;
    return {
      ...nextLine,
      manual_margin_pct: marginPct,
      unit_price: calculatePriceFromCostBase(baseCost, listFlete, marginPct, listImpuesto),
    };
  }

  return nextLine;
}
