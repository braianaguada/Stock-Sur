import type { ProductCombo, ProductComboFormLine, ProductComboLine } from "../types";
import { EMPTY_PRODUCT_COMBO_LINE } from "../types";

export type ComboFormState = {
  id: string | null;
  name: string;
  description: string;
  is_active: boolean;
  lines: ComboFormLineState[];
};

export type ComboFormLineState = ProductComboFormLine & {
  clientId: string;
};

export function buildEmptyComboForm(): ComboFormState {
  return {
    id: null,
    name: "",
    description: "",
    is_active: true,
    lines: [createComboFormLineState()],
  };
}

export function createComboFormLineState(line?: Partial<ProductComboFormLine>): ComboFormLineState {
  return {
    ...EMPTY_PRODUCT_COMBO_LINE,
    ...line,
    clientId: crypto.randomUUID(),
  };
}

export function buildComboFormFromData(combo: ProductCombo, comboLines: ProductComboLine[]): ComboFormState {
  const lines = comboLines.length > 0
    ? comboLines
        .slice()
        .sort((a, b) => a.line_order - b.line_order)
        .map((line) => ({
          clientId: line.id,
          item_id: line.item_id,
          quantity: Number(line.quantity),
          line_order: line.line_order,
          notes: line.notes ?? "",
        }))
    : [createComboFormLineState()];

  return {
    id: combo.id,
    name: combo.name,
    description: combo.description ?? "",
    is_active: combo.is_active,
    lines,
  };
}
