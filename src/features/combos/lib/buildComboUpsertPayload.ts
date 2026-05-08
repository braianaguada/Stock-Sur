import type { ProductComboFormLine } from "../types";

export function buildComboUpsertPayload(params: {
  companyId: string;
  comboId: string | null;
  name: string;
  description: string;
  isActive: boolean;
  lines: ProductComboFormLine[];
}) {
  const normalizedLines = params.lines
    .map((line, index) => ({
      item_id: line.item_id,
      quantity: Number(line.quantity),
      line_order: line.line_order || index + 1,
      notes: line.notes.trim() || null,
    }))
    .filter((line) => line.item_id);

  return {
    p_company_id: params.companyId,
    p_combo_id: params.comboId,
    p_name: params.name.trim(),
    p_description: params.description.trim() || null,
    p_is_active: params.isActive,
    p_lines: normalizedLines,
  };
}
