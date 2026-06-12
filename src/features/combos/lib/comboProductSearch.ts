import type { ProductComboFormLine } from "../types";
import { rankNaturalItemSearch } from "@/features/items/search";

export type ComboProductSearchItem = {
  id: string;
  sku: string | null;
  name: string;
  unit: string | null;
  brand: string | null;
  model: string | null;
  attributes: string | null;
  category: string | null;
  is_active: boolean;
};

export function filterComboProductOptions(items: ComboProductSearchItem[], query: string, limit = 8) {
  if (!query.trim()) return [];

  return rankNaturalItemSearch({
    items: items.filter((item) => item.is_active),
    aliases: [],
    query,
  })
    .slice(0, limit);
}

export function hasComboProductLine(lines: ProductComboFormLine[], itemId: string) {
  return lines.some((line) => line.item_id === itemId);
}
