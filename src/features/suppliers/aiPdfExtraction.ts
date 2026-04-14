import type { CatalogImportLine, ParsePdfResult } from "@/lib/importers/catalogImporter";

type SupplierPdfAiRow = {
  supplier_code?: string | null;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  page?: number | null;
  confidence?: number | null;
};

type SupplierPdfAiResponse = {
  lines?: SupplierPdfAiRow[];
  notes?: string[];
  meta?: {
    model?: string;
    pageCount?: number;
    fileName?: string;
    provider?: string;
  };
};

type SupplierPdfAiProvider = "gemini" | "mistral";

const PDF_AI_PROVIDER_SEQUENCE: Array<{
  provider: SupplierPdfAiProvider;
  functionName: "supplier-pdf-ai-extract" | "supplier-pdf-mistral-extract";
}> = [
  { provider: "gemini", functionName: "supplier-pdf-ai-extract" },
  { provider: "mistral", functionName: "supplier-pdf-mistral-extract" },
];

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
      const sourcePage = typeof row.page === "number" && row.page > 0 ? Math.trunc(row.page) : undefined;
      const confidence = typeof row.confidence === "number" && row.confidence > 0
        ? Math.max(0.1, Math.min(0.99, row.confidence))
        : undefined;

      if (!rawDescription || !Number.isFinite(cost) || cost <= 0) return null;

      return {
        supplier_code: supplierCode || null,
        raw_description: rawDescription,
        normalized_description: rawDescription.toLowerCase(),
        cost,
        currency: currency === "USD" ? "USD" : "ARS",
        row_index: index + 1,
        source_page: sourcePage,
        confidence,
      } satisfies CatalogImportLine;
    })
    .filter((row): row is CatalogImportLine => row !== null);
}

function normalizeCatalogDescription(value: string) {
  return value
    .replace(/[.]{3,}/g, " ")
    .replace(/\b(nuevo producto|nuevo|producto|s\/stock|neto)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyResidualNoise(line: CatalogImportLine) {
  const normalized = normalizeCatalogDescription(line.raw_description).toLowerCase();
  if (!normalized) return true;
  if (/^(codigo|base|altura|prof\.?|voltaje|rpm|pulg\.?|contactos?)$/.test(normalized)) return true;
  if (/^(a cm|b cm|c cm|con regulacion|sin regulacion)$/.test(normalized)) return true;
  if (normalized.length < 3) return true;
  return false;
}

export function cleanAiLines(lines: CatalogImportLine[]) {
  const deduped = new Map<string, CatalogImportLine>();

  lines.forEach((line, index) => {
    const rawDescription = normalizeCatalogDescription(line.raw_description);
    if (!rawDescription) return;

    const candidate: CatalogImportLine = {
      ...line,
      raw_description: rawDescription,
      normalized_description: rawDescription.toLowerCase(),
      row_index: index + 1,
    };

    if (isLikelyResidualNoise(candidate)) return;

    const dedupeKey = [
      candidate.supplier_code ?? "",
      candidate.normalized_description ?? "",
      candidate.currency,
      candidate.cost.toFixed(2),
      candidate.source_page ?? "",
    ].join("|");

    const existing = deduped.get(dedupeKey);
    if (!existing || (candidate.confidence ?? 0) > (existing.confidence ?? 0)) {
      deduped.set(dedupeKey, candidate);
    }
  });

  return Array.from(deduped.values()).map((line, index) => ({
    ...line,
    row_index: index + 1,
  }));
}

async function invokePdfExtractionFunction(
  functionName: "supplier-pdf-mistral-extract" | "supplier-pdf-ai-extract",
  file: File,
) {
  const { supabase } = await import("@/integrations/supabase/client");
  const fileBase64 = toBase64(await file.arrayBuffer());
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: {
      fileName: file.name,
      fileBase64,
    },
  });

  if (error) throw error;
  return data;
}

function toParsePdfResult(payload: SupplierPdfAiResponse): ParsePdfResult | null {
  const lines = cleanAiLines(normalizeAiRows(Array.isArray(payload.lines) ? payload.lines : []));
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
      provider: payload.meta?.provider ?? null,
      confidence: Math.min(
        0.98,
        0.48 +
          lines.length / 120 +
          (lines.reduce((sum, line) => sum + (line.confidence ?? 0.5), 0) / Math.max(lines.length, 1)) * 0.18,
      ),
    },
    table: {
      headers,
      rows,
      previewRows: rows.slice(0, 30),
      sourceMode: "ai",
    },
  };
}

function providerBonus(provider: string | null | undefined) {
  if (provider === "gemini") return 3;
  if (provider === "mistral") return 1;
  return 0;
}

function compareResults(left: ParsePdfResult, right: ParsePdfResult) {
  return scorePdfExtractionResult(left) - scorePdfExtractionResult(right);
}

export async function extractSupplierPdfWithAi(file: File): Promise<ParsePdfResult | null> {
  const results: ParsePdfResult[] = [];
  const errors: unknown[] = [];

  for (const candidate of PDF_AI_PROVIDER_SEQUENCE) {
    try {
      const payload = (await invokePdfExtractionFunction(candidate.functionName, file)) as SupplierPdfAiResponse;
      const result = toParsePdfResult({
        ...payload,
        meta: { ...payload.meta, provider: candidate.provider },
      });
      if (result) results.push(result);
    } catch (error) {
      errors.push(error);
    }
  }

  if (results.length > 0) {
    return [...results].sort((left, right) => compareResults(right, left))[0] ?? null;
  }

  if (errors.length > 0) {
    throw errors[0];
  }

  return null;
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
  const pageCount = new Set(result.lines.map((line) => line.source_page).filter((page): page is number => typeof page === "number")).size;
  const avgLineConfidence = result.lines.length
    ? result.lines.reduce((accumulator, line) => accumulator + (line.confidence ?? result.meta.confidence), 0) / result.lines.length
    : result.meta.confidence;
  const avgDescriptionLength = result.lines.length
    ? result.lines.reduce((acc, line) => acc + line.raw_description.length, 0) / result.lines.length
    : 0;
  return (
    result.lines.length * 1.4 +
    tableRowCount * 1.1 +
    result.meta.confidence * 32 +
    avgLineConfidence * 18 +
    codeCount * 0.4 +
    pageCount * 1.5 +
    Math.min(18, avgDescriptionLength / 4) +
    (result.meta.mode === "ai" ? 8 : 0) +
    providerBonus(result.meta.provider)
  );
}
