import type { ProductComboFormLine } from "../types";

export type ComboProductSearchItem = {
  id: string;
  sku: string | null;
  name: string;
  unit: string | null;
  brand: string | null;
  category: string | null;
  is_active: boolean;
};

export function filterComboProductOptions(items: ComboProductSearchItem[], query: string, limit = 8) {
  const term = query.trim().toLowerCase();
  if (!term) return [];

  return items
    .filter((item) => item.is_active)
    .filter((item) =>
      [item.sku, item.name, item.brand, item.category, item.unit]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term)),
    )
    .slice(0, limit);
}

export function hasComboProductLine(lines: ProductComboFormLine[], itemId: string) {
  return lines.some((line) => line.item_id === itemId);
}
