import type { LineDraft } from "@/features/documents/types";

export function mergeComboDocumentLines(existingLines: LineDraft[], comboLines: LineDraft[]) {
  const nextLines = existingLines.map((line) => ({ ...line }));

  for (const comboLine of comboLines) {
    if (!comboLine.item_id) {
      nextLines.push({ ...comboLine });
      continue;
    }

    const existingIndex = nextLines.findIndex((line) => line.item_id === comboLine.item_id);
    if (existingIndex >= 0) {
      nextLines[existingIndex] = {
        ...nextLines[existingIndex],
        quantity: nextLines[existingIndex].quantity + comboLine.quantity,
      };
      continue;
    }

    nextLines.push({ ...comboLine });
  }

  return nextLines;
}
