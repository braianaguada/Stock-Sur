import type { ExtractionReviewLine } from "@/features/suppliers/types";

export interface SupplierImportValidation {
  invalidLineIds: Set<string>;
  invalidDescriptionCount: number;
  invalidPriceCount: number;
  unresolvedCurrencyCount: number;
  duplicateCodeCount: number;
  canImport: boolean;
}

const normalizeCode = (value: string | null) => value?.trim().toLocaleUpperCase("es-AR") ?? "";

export function validateSupplierImportLines(lines: ExtractionReviewLine[]): SupplierImportValidation {
  const invalidLineIds = new Set<string>();
  const codeOccurrences = new Map<string, number>();
  let invalidDescriptionCount = 0;
  let invalidPriceCount = 0;
  let unresolvedCurrencyCount = 0;

  for (const line of lines) {
    const description = (line.product_name ?? line.raw_description).trim();
    const unresolvedCurrency = ["AMBIGUOUS", "UNSUPPORTED"].includes(
      line.currency_detection?.status ?? "",
    );

    if (!description) {
      invalidDescriptionCount += 1;
      invalidLineIds.add(line.id);
    }
    if (!Number.isFinite(line.cost) || line.cost <= 0) {
      invalidPriceCount += 1;
      invalidLineIds.add(line.id);
    }
    if (unresolvedCurrency) {
      unresolvedCurrencyCount += 1;
      invalidLineIds.add(line.id);
    }

    const code = normalizeCode(line.supplier_code);
    if (code) codeOccurrences.set(code, (codeOccurrences.get(code) ?? 0) + 1);
  }

  const duplicateCodeCount = [...codeOccurrences.values()].reduce(
    (total, count) => total + Math.max(0, count - 1),
    0,
  );

  return {
    invalidLineIds,
    invalidDescriptionCount,
    invalidPriceCount,
    unresolvedCurrencyCount,
    duplicateCodeCount,
    canImport: lines.length > 0 && invalidLineIds.size === 0,
  };
}
