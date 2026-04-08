import { parsePrice } from "@/lib/importParserCore";
import type { ImportMappingState, ImportPreviewRow, ParsedRow } from "@/features/imports/types";

export function buildImportPreviewRows(rows: ParsedRow[], mapping: ImportMappingState): ImportPreviewRow[] {
  return rows.slice(0, 50).map((row) => ({
    supplier_code: mapping.supplier_code && mapping.supplier_code !== "__none__" ? row[mapping.supplier_code] ?? "" : "",
    raw_description: row[mapping.description] ?? "",
    price: parsePrice(row[mapping.price] ?? "0"),
  }));
}
