type XlsxModule = typeof import("xlsx");
type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
import { loadPdfJs, loadTesseract, loadXlsx } from "@/lib/lazy-vendors";
type MergeRange = {
  s: { r: number; c: number };
  e: { r: number; c: number };
};

export type MatchStatus = "MATCHED" | "PENDING" | "NEW";

export interface CatalogImportLine {
  supplier_code: string | null;
  raw_description: string;
  normalized_description: string | null;
  cost: number;
  currency: string;
  row_index: number;
}

export interface DroppedRowSample {
  rowIndex: number;
  reason: "empty_row" | "missing_desc" | "invalid_price" | "price_le_zero";
  rowPreview: string[];
}

export interface NormalizeDiagnostics {
  totalRows: number;
  keptRows: number;
  dropped_emptyRow: number;
  dropped_missingDesc: number;
  dropped_invalidPrice: number;
  dropped_priceLE0: number;
  sampleDropped: DroppedRowSample[];
}

export interface ParsedSheetData {
  sheetName: string;
  headers: string[];
  rows: string[][];
  previewRows: string[][];
  hasHeaderRow: boolean;
  detectedBlocks: number;
}

export interface ColumnHeuristicScore {
  index: number;
  key: string;
  label: string;
  descriptionScore: number;
  priceScore: number;
}

export interface ColumnDetectionResult {
  descriptionColumn: string;
  priceColumn: string;
  supplierCodeColumn: string | null;
  currencyColumn: string | null;
  confidence: number;
  scores: ColumnHeuristicScore[];
}

export interface MappingSelectionCore {
  descriptionColumn: string;
  priceColumn: string;
  currencyColumn: string | null;
  supplierCodeColumn: string | null;
}

export type ParsePdfMode = "text" | "ocr" | "ai";

export interface ParsePdfMeta {
  mode: ParsePdfMode;
  totalChars: number;
  parsedPages: number;
  confidence: number;
}

export interface PdfTableCandidate {
  headers: string[];
  rows: string[][];
  previewRows: string[][];
  sourceMode: ParsePdfMode;
}

export interface ParsePdfOptions {
  preferPrice: "first" | "last";
  defaultCurrency: "ARS" | "USD";
  maxPages: number;
  textThresholdChars: number;
  maxOcrMs: number;
}

export interface ParsePdfProgress {
  phase: ParsePdfMode;
  currentPage: number;
  totalPages: number;
  message: string;
}

export interface ParsePdfResult {
  lines: CatalogImportLine[];
  meta: ParsePdfMeta;
  table: PdfTableCandidate | null;
}

export const DEFAULT_PDF_OPTIONS: ParsePdfOptions = {
  preferPrice: "last",
  defaultCurrency: "ARS",
  maxPages: 30,
  textThresholdChars: 500,
  maxOcrMs: 120000,
};

const MAX_IMPORT_ROWS = 10000;
const HEADER_COL_PREFIX = "col_";
const DESCRIPTION_KEYWORDS = [
  "descripcion",
  "descripción",
  "description",
  "producto",
  "item",
  "articulo",
  "artículo",
  "detalle",
  "nombre",
  "model",
  "modelo",
  "code+desc",
  "codigo descripcion",
  "código descripción",
];
const PRICE_KEYWORDS = ["precio", "costo", "cost", "importe", "lista", "price", "unitario", "pvp", "$", "ars", "usd"];
const CURRENCY_KEYWORDS = ["moneda", "currency", "curr", "divisa"];
const CODE_KEYWORDS = ["codigo", "código", "cod", "sku", "ean", "upc", "ref", "referencia"];


function sanitizeHeaderRow(rawHeaders: string[]): string[] {
  const used = new Set<string>();
  return rawHeaders.map((raw, index) => {
    const base = (raw ?? "").trim() || `${HEADER_COL_PREFIX}${index + 1}`;
    let value = base;
    let suffix = 2;
    while (used.has(value)) {
      value = `${base}_${suffix}`;
      suffix += 1;
    }
    used.add(value);
    return value;
  });
}

function normalizeCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return String(value).replace(/\u00A0/g, " ").trim();
}

function isLikelyDate(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) return false;
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(normalized)) return true;
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(normalized)) return true;
  return false;
}

function looksLikeHeaderRow(row: string[]): boolean {
  const nonEmpty = row.map((cell) => cell.trim()).filter(Boolean);
  if (nonEmpty.length < 2) return false;
  const alphaCells = nonEmpty.filter((cell) => /[a-zA-Záéíóúñ]/i.test(cell)).length;
  const numericCells = nonEmpty.filter((cell) => parseFlexibleNumber(cell) !== null).length;
  return alphaCells >= 2 && numericCells <= Math.floor(nonEmpty.length / 2);
}

function fillMergedCells(matrix: string[][], merges: MergeRange[] | undefined): string[][] {
  if (!merges || merges.length === 0) return matrix;
  const out = matrix.map((row) => [...row]);
  merges.forEach((range) => {
    const value = out[range.s.r]?.[range.s.c] ?? "";
    for (let r = range.s.r; r <= range.e.r; r += 1) {
      for (let c = range.s.c; c <= range.e.c; c += 1) {
        if (!out[r]) out[r] = [];
        if (!out[r][c]) out[r][c] = value;
      }
    }
  });
  return out;
}

function getActiveColumns(row: string[]): number {
  return row.filter((cell) => cell.trim().length > 0).length;
}

function isSectionLikeRow(row: string[]): boolean {
  const nonEmpty = row.filter((cell) => cell.trim().length > 0);
  if (nonEmpty.length <= 1) return true;
  const numeric = nonEmpty.filter((cell) => parseFlexibleNumber(cell) !== null).length;
  return numeric === 0 && nonEmpty.join(" ").length > 30;
}

function detectBlocks(rows: string[][]): Array<{ start: number; end: number }> {
  const blocks: Array<{ start: number; end: number }> = [];
  let currentStart: number | null = null;
  let sparseStreak = 0;
  rows.forEach((row, index) => {
    const activeColumns = getActiveColumns(row);
    const isSparse = activeColumns < 2;
    if (!isSparse && currentStart === null) currentStart = index;
    if (currentStart !== null) {
      if (isSparse && !isSectionLikeRow(row)) sparseStreak += 1;
      else sparseStreak = 0;
      if (sparseStreak >= 2) {
        blocks.push({ start: currentStart, end: Math.max(currentStart, index - sparseStreak) });
        currentStart = null;
        sparseStreak = 0;
      }
    }
  });
  if (currentStart !== null) blocks.push({ start: currentStart, end: rows.length - 1 });
  return blocks.filter((b) => b.end - b.start >= 1);
}

export function parseFlexibleNumber(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;
  let normalized = value
    .replace(/\s+/g, "")
    .replace(/[\u00A0\u202F]/g, "")
    .replace(/[$€£¥]/g, "")
    .replace(/(ars|usd|eur|u\$s|us\$)/gi, "")
    .replace(/[^\d,.-]/g, "");
  if (!normalized) return null;
  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");
  if (hasComma && hasDot) {
    normalized = normalized.lastIndexOf(",") > normalized.lastIndexOf(".")
      ? normalized.replace(/\./g, "").replace(",", ".")
      : normalized.replace(/,/g, "");
  } else if (hasComma) {
    const commaCount = (normalized.match(/,/g) ?? []).length;
    normalized = commaCount > 1
      ? normalized.replace(/,/g, (match, offset) => (offset === normalized.lastIndexOf(",") ? "." : ""))
      : normalized.replace(",", ".");
  } else if (hasDot) {
    const dotCount = (normalized.match(/\./g) ?? []).length;
    normalized = dotCount > 1
      ? normalized.replace(/\./g, (match, offset) => (offset === normalized.lastIndexOf(".") ? "." : ""))
      : normalized;
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function detectColumnsHeuristic(headers: string[], rows: string[][]): ColumnDetectionResult {
  const scores: ColumnHeuristicScore[] = headers.map((header, colIndex) => {
    const values = rows.map((row) => (row[colIndex] ?? "").trim()).filter(Boolean);
    const total = values.length || 1;
    const numericValues = values.map((value) => parseFlexibleNumber(value));
    const numericCount = numericValues.filter((value) => value !== null).length;
    const decimalCount = values.filter((value) => /[,.]\d{1,3}$/.test(value)).length;
    const longTextCount = values.filter((value) => value.length >= 8).length;
    const textCount = values.filter((value) => /[a-zA-Záéíóúñ]/i.test(value)).length;
    const dateLikeCount = values.filter((value) => isLikelyDate(value)).length;
    const uniqueRatio = values.length ? new Set(values.map((value) => value.toLowerCase())).size / values.length : 0;
    const headerLower = header.toLowerCase();
    let descriptionScore = 0;
    let priceScore = 0;
    if (DESCRIPTION_KEYWORDS.some((keyword) => headerLower.includes(keyword))) descriptionScore += 3.5;
    if (PRICE_KEYWORDS.some((keyword) => headerLower.includes(keyword))) priceScore += 3.5;
    if (CURRENCY_KEYWORDS.some((keyword) => headerLower.includes(keyword))) priceScore += 0.5;
    const numericRatio = numericCount / total;
    const longTextRatio = longTextCount / total;
    const textRatio = textCount / total;
    const dateRatio = dateLikeCount / total;
    const decimalRatio = decimalCount / total;
    descriptionScore += longTextRatio * 3.2 + textRatio * 2.2 + uniqueRatio * 1.4 - numericRatio * 2.8 - dateRatio * 2.5;
    const integerValues = numericValues.filter((value): value is number => value !== null && Number.isInteger(value));
    const integerRatio = integerValues.length / total;
    const integerMax = integerValues.length ? Math.max(...integerValues) : 0;
    const quantityLike = integerRatio > 0.85 && integerMax <= 200;
    priceScore += numericRatio * 4.4 + decimalRatio * 1.3 + (values.filter((value) => /[$]|ars|usd/i.test(value)).length / total);
    priceScore -= longTextRatio * 1.8 + dateRatio * 1.8;
    if (quantityLike) priceScore -= 1.6;
    if (values.length === 0) {
      descriptionScore -= 5;
      priceScore -= 5;
    }
    return { index: colIndex, key: header, label: header, descriptionScore, priceScore };
  });
  const sortedDesc = [...scores].sort((a, b) => b.descriptionScore - a.descriptionScore);
  const bestDesc = sortedDesc[0];
  const secondDesc = sortedDesc[1] ?? sortedDesc[0];
  const sortedPrice = [...scores].filter((entry) => entry.index !== bestDesc.index).sort((a, b) => b.priceScore - a.priceScore);
  const bestPrice = sortedPrice[0] ?? [...scores].sort((a, b) => b.priceScore - a.priceScore)[0];
  const secondPrice = sortedPrice[1] ?? bestPrice;
  const descGap = Math.max(0, bestDesc.descriptionScore - secondDesc.descriptionScore);
  const priceGap = Math.max(0, bestPrice.priceScore - secondPrice.priceScore);
  const confidence = Math.max(0, Math.min(1, (Math.min(descGap, 4) / 4 + Math.min(priceGap, 4) / 4) / 2));
  const supplierCodeColumn = scores
    .filter((entry) => CODE_KEYWORDS.some((keyword) => entry.key.toLowerCase().includes(keyword)))
    .sort((a, b) => b.descriptionScore - a.descriptionScore)[0]?.key ?? null;
  const currencyColumn = scores
    .filter((entry) => CURRENCY_KEYWORDS.some((keyword) => entry.key.toLowerCase().includes(keyword)))
    .sort((a, b) => b.priceScore - a.priceScore)[0]?.key ?? null;
  return {
    descriptionColumn: bestDesc.key,
    priceColumn: bestPrice.key,
    supplierCodeColumn,
    currencyColumn,
    confidence,
    scores,
  };
}

export async function parseXlsxToRows(file: File): Promise<ParsedSheetData> {
  const XLSX = await loadXlsx();
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("El XLSX no contiene hojas");
  const sheet = workbook.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, blankrows: false, defval: "" });
  const normalizedRows = matrix.map((row) => row.map(normalizeCellValue));
  const mergedAwareRows = fillMergedCells(normalizedRows, sheet["!merges"] as MergeRange[] | undefined);
  const nonEmptyRows = mergedAwareRows.filter((row) => row.some((cell) => cell.trim().length > 0));
  if (nonEmptyRows.length === 0) throw new Error("Archivo vacio o sin datos");
  const maxColumns = nonEmptyRows.reduce((max, row) => Math.max(max, row.length), 0);
  const paddedRows = nonEmptyRows.map((row) => {
    const out = [...row];
    while (out.length < maxColumns) out.push("");
    return out;
  });
  const blocks = detectBlocks(paddedRows);
  const flattenedDataRows: string[][] = [];
  let selectedHeaders: string[] = [];
  let hasHeaderRow = false;
  blocks.forEach((block, blockIndex) => {
    const blockRows = paddedRows.slice(block.start, block.end + 1);
    if (blockRows.length < 2) return;
    const blockHasHeader = looksLikeHeaderRow(blockRows[0]);
    const blockHeaders = blockHasHeader
      ? sanitizeHeaderRow(blockRows[0])
      : sanitizeHeaderRow(Array.from({ length: maxColumns }, (_, idx) => `${HEADER_COL_PREFIX}${idx + 1}`));
    const dataRows = (blockHasHeader ? blockRows.slice(1) : blockRows)
      .filter((row) => row.some((cell) => cell.trim().length > 0))
      .filter((row) => !isSectionLikeRow(row));
    if (dataRows.length === 0) return;
    if (blockIndex === 0 || selectedHeaders.length === 0) {
      selectedHeaders = blockHeaders;
      hasHeaderRow = blockHasHeader;
    }
    flattenedDataRows.push(...dataRows);
  });
  if (flattenedDataRows.length === 0) throw new Error("No se detectaron bloques tabulares en el XLSX");
  const headers = selectedHeaders.length > 0 ? selectedHeaders : sanitizeHeaderRow(Array.from({ length: maxColumns }, (_, i) => `${HEADER_COL_PREFIX}${i + 1}`));
  return {
    sheetName: firstSheetName,
    headers,
    rows: flattenedDataRows,
    previewRows: flattenedDataRows.slice(0, 20),
    hasHeaderRow,
    detectedBlocks: Math.max(1, blocks.length),
  };
}

function detectCurrency(rawValue: string, fallback: "ARS" | "USD"): string {
  if (/u\$s|us\$|usd/i.test(rawValue)) return "USD";
  if (/ars|\$/i.test(rawValue)) return "ARS";
  return fallback;
}

export function normalizeRowsToLines({
  headers,
  rows,
  mapping,
}: {
  headers: string[];
  rows: string[][];
  mapping: MappingSelectionCore;
}): { lines: CatalogImportLine[]; diagnostics: NormalizeDiagnostics } {
  const headerIndexMap = new Map(headers.map((header, index) => [header, index]));
  const descriptionIndex = headerIndexMap.get(mapping.descriptionColumn);
  const priceIndex = headerIndexMap.get(mapping.priceColumn);
  const codeIndex = mapping.supplierCodeColumn ? headerIndexMap.get(mapping.supplierCodeColumn) : undefined;
  const currencyIndex = mapping.currencyColumn ? headerIndexMap.get(mapping.currencyColumn) : undefined;
  if (descriptionIndex === undefined || priceIndex === undefined) throw new Error("Mapeo invalido: faltan columnas requeridas");
  const diagnostics: NormalizeDiagnostics = {
    totalRows: 0,
    keptRows: 0,
    dropped_emptyRow: 0,
    dropped_missingDesc: 0,
    dropped_invalidPrice: 0,
    dropped_priceLE0: 0,
    sampleDropped: [],
  };
  const lines: CatalogImportLine[] = [];
  rows.slice(0, MAX_IMPORT_ROWS).forEach((row, rowIndex) => {
    diagnostics.totalRows += 1;
    const rowValues = row.map((cell) => String(cell ?? "").trim());
    if (!rowValues.some(Boolean)) {
      diagnostics.dropped_emptyRow += 1;
      if (diagnostics.sampleDropped.length < 10) diagnostics.sampleDropped.push({ rowIndex: rowIndex + 1, reason: "empty_row", rowPreview: rowValues.slice(0, 6) });
      return;
    }
    const rawDescription = String(row[descriptionIndex] ?? "").replace(/\s+/g, " ").trim();
    if (!rawDescription) {
      diagnostics.dropped_missingDesc += 1;
      if (diagnostics.sampleDropped.length < 10) diagnostics.sampleDropped.push({ rowIndex: rowIndex + 1, reason: "missing_desc", rowPreview: rowValues.slice(0, 6) });
      return;
    }
    const rawPrice = String(row[priceIndex] ?? "").trim();
    const parsedPrice = parseFlexibleNumber(rawPrice);
    if (parsedPrice === null) {
      diagnostics.dropped_invalidPrice += 1;
      if (diagnostics.sampleDropped.length < 10) diagnostics.sampleDropped.push({ rowIndex: rowIndex + 1, reason: "invalid_price", rowPreview: rowValues.slice(0, 6) });
      return;
    }
    if (parsedPrice <= 0) {
      diagnostics.dropped_priceLE0 += 1;
      if (diagnostics.sampleDropped.length < 10) diagnostics.sampleDropped.push({ rowIndex: rowIndex + 1, reason: "price_le_zero", rowPreview: rowValues.slice(0, 6) });
      return;
    }
    const supplierCode = codeIndex !== undefined ? String(row[codeIndex] ?? "").trim() : "";
    const rawCurrency = currencyIndex !== undefined ? String(row[currencyIndex] ?? "").trim() : "";
    const currency = (rawCurrency ? rawCurrency.toUpperCase() : detectCurrency(`${rawPrice} ${rawDescription}`, "ARS")) || "ARS";
    lines.push({
      supplier_code: supplierCode || null,
      raw_description: rawDescription,
      normalized_description: rawDescription.toLowerCase(),
      cost: parsedPrice,
      currency,
      row_index: rowIndex + 1,
    });
    diagnostics.keptRows += 1;
  });
  return { lines, diagnostics };
}

function textItemsToVisualLines(items: Array<{ str: string; transform: number[] }>): string[] {
  const buckets = new Map<number, Array<{ x: number; str: string }>>();
  items.forEach((item) => {
    const raw = String(item.str ?? "").trim();
    if (!raw) return;
    const y = Math.round((item.transform?.[5] ?? 0) / 2) * 2;
    const x = item.transform?.[4] ?? 0;
    if (!buckets.has(y)) buckets.set(y, []);
    buckets.get(y)!.push({ x, str: raw });
  });
  return [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, row]) => row.sort((a, b) => a.x - b.x).map((part) => part.str).join(" ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function clusterXPositions(positions: number[], tolerance = 24): number[] {
  if (positions.length === 0) return [];
  const sorted = [...positions].sort((a, b) => a - b);
  const clusters: number[] = [sorted[0]];
  sorted.slice(1).forEach((x) => {
    const last = clusters[clusters.length - 1];
    if (Math.abs(x - last) <= tolerance) {
      clusters[clusters.length - 1] = (last + x) / 2;
    } else {
      clusters.push(x);
    }
  });
  return clusters;
}

function textItemsToTableRows(items: Array<{ str: string; transform: number[] }>): string[][] {
  const rowsByY = new Map<number, Array<{ x: number; str: string }>>();
  items.forEach((item) => {
    const str = item.str.trim();
    if (!str) return;
    const y = Math.round((item.transform?.[5] ?? 0) / 2) * 2;
    const x = item.transform?.[4] ?? 0;
    if (!rowsByY.has(y)) rowsByY.set(y, []);
    rowsByY.get(y)!.push({ x, str });
  });
  const allX = [...rowsByY.values()].flatMap((row) => row.map((cell) => cell.x));
  const clusters = clusterXPositions(allX);
  if (clusters.length === 0) return [];
  const tableRows = [...rowsByY.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, rowCells]) => {
      const cells = Array.from({ length: clusters.length }, () => "");
      rowCells
        .sort((a, b) => a.x - b.x)
        .forEach((cell) => {
          let bestIdx = 0;
          let bestDistance = Number.POSITIVE_INFINITY;
          clusters.forEach((clusterX, idx) => {
            const distance = Math.abs(clusterX - cell.x);
            if (distance < bestDistance) {
              bestDistance = distance;
              bestIdx = idx;
            }
          });
          cells[bestIdx] = cells[bestIdx] ? `${cells[bestIdx]} ${cell.str}` : cell.str;
        });
      return cells.map((value) => value.replace(/\s+/g, " ").trim());
    })
    .filter((row) => row.some((cell) => cell.length > 0));
  return tableRows;
}

function ocrLineToTableRow(line: string): string[] {
  const normalized = line.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const wideSplit = line.split(/\s{2,}/).map((part) => part.trim()).filter(Boolean);
  if (wideSplit.length >= 2) return wideSplit;
  return normalized.split(" ").filter(Boolean);
}

function extractPdfLineCandidate(
  sourceLine: string,
  rowIndex: number,
  preferPrice: "first" | "last",
  defaultCurrency: "ARS" | "USD",
): CatalogImportLine | null {
  const line = sourceLine.replace(/\s+/g, " ").trim();
  if (!line || line.length < 4) return null;
  const chunks = line.split(/\s{2,}/).filter(Boolean);
  const candidateString = chunks.length > 1 ? chunks.join(" | ") : line;
  const numberMatches = [...candidateString.matchAll(/-?\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d+)?|-?\d+(?:[.,]\d+)?/g)];
  const prices = numberMatches
    .map((match) => ({ raw: match[0], value: parseFlexibleNumber(match[0]) }))
    .filter((entry): entry is { raw: string; value: number } => entry.value !== null);
  if (prices.length === 0) return null;
  const pickedPrice = preferPrice === "first" ? prices[0] : prices[prices.length - 1];
  if (!pickedPrice || pickedPrice.value <= 0) return null;
  const currency = detectCurrency(candidateString, defaultCurrency);
  let description = line
    .replace(pickedPrice.raw, " ")
    .replace(/\b(u\$s|us\$|usd|ars)\b/gi, " ")
    .replace(/\$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const codeMatch = description.match(/^([A-Z0-9][A-Z0-9\-_./]{1,15})\s+(.+)$/i);
  const supplierCode = codeMatch ? codeMatch[1] : null;
  description = codeMatch ? codeMatch[2].trim() : description;
  if (description.length < 3) return null;
  if (!/[a-zA-Záéíóúñ]/i.test(description)) return null;
  return {
    supplier_code: supplierCode,
    raw_description: description,
    normalized_description: description.toLowerCase(),
    cost: pickedPrice.value,
    currency,
    row_index: rowIndex,
  };
}

async function parsePdfTextMode(
  file: File,
  options: ParsePdfOptions,
  onProgress?: (progress: ParsePdfProgress) => void,
): Promise<{ lines: CatalogImportLine[]; chars: number; pages: number; tableRows: string[][] }> {
  const { getDocument } = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const totalPages = Math.min(pdf.numPages, options.maxPages);
  const lines: CatalogImportLine[] = [];
  const tableRows: string[][] = [];
  let rowIndex = 1;
  let chars = 0;
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    onProgress?.({
      phase: "text",
      currentPage: pageNumber,
      totalPages,
      message: `Extrayendo texto PDF ${pageNumber}/${totalPages}`,
    });
    const page = await pdf.getPage(pageNumber) as {
      getTextContent: () => Promise<{ items: unknown[] }>;
    };
    const content = await page.getTextContent();
    const items = content.items
      .map((item) => {
        if (!("str" in item) || !("transform" in item)) return null;
        return { str: String(item.str ?? ""), transform: item.transform as number[] };
      })
      .filter((item): item is { str: string; transform: number[] } => item !== null);
    chars += items.reduce((acc, item) => acc + item.str.replace(/\s+/g, "").length, 0);
    const visualLines = textItemsToVisualLines(items);
    tableRows.push(...textItemsToTableRows(items));
    visualLines.forEach((line) => {
      const parsed = extractPdfLineCandidate(line, rowIndex, options.preferPrice, options.defaultCurrency);
      rowIndex += 1;
      if (parsed) lines.push(parsed);
    });
  }
  return { lines, chars, pages: totalPages, tableRows };
}

async function parsePdfOcrMode(
  file: File,
  options: ParsePdfOptions,
  onProgress?: (progress: ParsePdfProgress) => void,
): Promise<{ lines: CatalogImportLine[]; pages: number; tableRows: string[][] }> {
  const { getDocument } = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const totalPages = Math.min(pdf.numPages, options.maxPages);
  const { createWorker } = await loadTesseract();
  const worker = await createWorker("spa+eng");
  const lines: CatalogImportLine[] = [];
  const tableRows: string[][] = [];
  let rowIndex = 1;
  const start = Date.now();
  try {
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      if (Date.now() - start > options.maxOcrMs) break;
      onProgress?.({
        phase: "ocr",
        currentPage: pageNumber,
        totalPages,
        message: `OCR pagina ${pageNumber}/${totalPages}`,
      });
      const page = await pdf.getPage(pageNumber) as {
        getViewport: (args: { scale: number }) => { width: number; height: number };
        render: (args: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> };
      };
      const viewport = page.getViewport({ scale: 2.5 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) continue;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvasContext: context, viewport }).promise;
      const result = await worker.recognize(canvas);
      const textLines = result.data.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      textLines.forEach((line) => {
        const row = ocrLineToTableRow(line);
        if (row.length > 0) tableRows.push(row);
        const parsed = extractPdfLineCandidate(line, rowIndex, options.preferPrice, options.defaultCurrency);
        rowIndex += 1;
        if (parsed) lines.push(parsed);
      });
      if (pageNumber >= 2 && lines.length >= 30) break;
    }
  } finally {
    await worker.terminate();
  }
  return { lines, pages: totalPages, tableRows };
}

export async function parsePdfToLines(
  file: File,
  optionsInput?: Partial<ParsePdfOptions>,
  onProgress?: (progress: ParsePdfProgress) => void,
): Promise<ParsePdfResult> {
  const options: ParsePdfOptions = { ...DEFAULT_PDF_OPTIONS, ...(optionsInput ?? {}) };
  const textMode = await parsePdfTextMode(file, options, onProgress);
  const textMaxCols = textMode.tableRows.reduce((max, row) => Math.max(max, row.length), 0);
  const textHeaders = Array.from({ length: textMaxCols }, (_, idx) => `col_${idx + 1}`);
  const textTableRows = textMode.tableRows.map((row) => {
    const padded = [...row];
    while (padded.length < textMaxCols) padded.push("");
    return padded;
  });
  if (textMode.chars >= options.textThresholdChars && textMode.lines.length > 0) {
    const confidence = Math.min(1, textMode.lines.length / 80);
    return {
      lines: textMode.lines,
      meta: {
        mode: "text",
        totalChars: textMode.chars,
        parsedPages: textMode.pages,
        confidence,
      },
      table: textMaxCols > 0
        ? {
          headers: textHeaders,
          rows: textTableRows,
          previewRows: textTableRows.slice(0, 30),
          sourceMode: "text",
        }
        : null,
    };
  }
  const ocrMode = await parsePdfOcrMode(file, options, onProgress);
  const ocrMaxCols = ocrMode.tableRows.reduce((max, row) => Math.max(max, row.length), 0);
  const ocrHeaders = Array.from({ length: ocrMaxCols }, (_, idx) => `col_${idx + 1}`);
  const ocrTableRows = ocrMode.tableRows.map((row) => {
    const padded = [...row];
    while (padded.length < ocrMaxCols) padded.push("");
    return padded;
  });
  const confidence = Math.min(1, ocrMode.lines.length / 80);
  return {
    lines: ocrMode.lines,
    meta: {
      mode: "ocr",
      totalChars: textMode.chars,
      parsedPages: ocrMode.pages,
      confidence,
    },
    table: ocrMaxCols > 0
      ? {
        headers: ocrHeaders,
        rows: ocrTableRows,
        previewRows: ocrTableRows.slice(0, 30),
        sourceMode: "ocr",
      }
      : null,
  };
}
