import { supabase } from "@/integrations/supabase/client";
import type { CatalogImportLine, ParsePdfResult } from "@/lib/importers/catalogImporter";

type SupplierPdfAiRow = {
  supplier_code?: string | null;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
};

type SupplierPdfAiResponse = {
  lines?: SupplierPdfAiRow[];
  notes?: string[];
  meta?: {
    model?: string;
    pageCount?: number;
    fileName?: string;
  };
};

function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return window.btoa(binary);
}

function normalizeAiRows(rows: SupplierPdfAiRow[]): CatalogImportLine[] {
  return rows
    .map((row, index) => {
      const rawDescription = String(row.description ?? "").replace(/\s+/g, " ").trim();
      const cost = typeof row.price === "number" ? row.price : Number.NaN;
      const currency = String(row.currency ?? "ARS").trim().toUpperCase() || "ARS";
      const supplierCode = String(row.supplier_code ?? "").trim();

      if (!rawDescription || !Number.isFinite(cost) || cost <= 0) return null;

      return {
        supplier_code: supplierCode || null,
        raw_description: rawDescription,
        normalized_description: rawDescription.toLowerCase(),
        cost,
        currency: currency === "USD" ? "USD" : "ARS",
        row_index: index + 1,
      } satisfies CatalogImportLine;
    })
    .filter((row): row is CatalogImportLine => row !== null);
}

export async function extractSupplierPdfWithAi(file: File): Promise<ParsePdfResult | null> {
  const fileBase64 = toBase64(await file.arrayBuffer());
  const { data, error } = await supabase.functions.invoke("supplier-pdf-ai-extract", {
    body: {
      fileName: file.name,
      fileBase64,
    },
  });

  if (error) throw error;

  const payload = (data ?? {}) as SupplierPdfAiResponse;
  const lines = normalizeAiRows(Array.isArray(payload.lines) ? payload.lines : []);
  if (lines.length === 0) return null;

  const headers = ["supplier_code", "description", "price", "currency"];
  const rows = lines.map((line) => [
    line.supplier_code ?? "",
    line.raw_description,
    String(line.cost),
    line.currency,
  ]);

  return {
    lines,
    meta: {
      mode: "ai",
      totalChars: lines.reduce((total, line) => total + line.raw_description.length, 0),
      parsedPages: typeof payload.meta?.pageCount === "number" ? payload.meta.pageCount : 0,
      confidence: Math.min(0.98, 0.45 + lines.length / 120),
    },
    table: {
      headers,
      rows,
      previewRows: rows.slice(0, 30),
      sourceMode: "ai",
    },
  };
}

export function shouldTryAiPdfExtraction(nativeResult: ParsePdfResult) {
  const tableRowCount = nativeResult.table?.rows.length ?? 0;
  const codeCount = nativeResult.lines.filter((line) => !!line.supplier_code).length;
  return (
    nativeResult.meta.mode === "ocr" ||
    nativeResult.meta.confidence < 0.45 ||
    nativeResult.lines.length < 20 ||
    tableRowCount < 12 ||
    (nativeResult.lines.length >= 10 && codeCount / nativeResult.lines.length < 0.08)
  );
}

export function scorePdfExtractionResult(result: ParsePdfResult) {
  const tableRowCount = result.table?.rows.length ?? 0;
  const codeCount = result.lines.filter((line) => !!line.supplier_code).length;
  const avgDescriptionLength = result.lines.length
    ? result.lines.reduce((acc, line) => acc + line.raw_description.length, 0) / result.lines.length
    : 0;
  return (
    result.lines.length * 1.4 +
    tableRowCount * 1.1 +
    result.meta.confidence * 40 +
    codeCount * 0.4 +
    Math.min(18, avgDescriptionLength / 4) +
    (result.meta.mode === "ai" ? 4 : 0)
  );
}
