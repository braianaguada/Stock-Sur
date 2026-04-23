type MergeRange = {
  s: { r: number; c: number };
  e: { r: number; c: number };
};

const HEADER_COL_PREFIX = "col_";

const DESCRIPTION_KEYWORDS = [
  "descripcion",
  "descripciÃ³n",
  "description",
  "producto",
  "item",
  "articulo",
  "artÃ­culo",
  "detalle",
  "nombre",
  "model",
  "modelo",
  "code+desc",
  "codigo descripcion",
  "cÃ³digo descripciÃ³n",
];
const PRICE_KEYWORDS = ["precio", "costo", "cost", "importe", "lista", "price", "unitario", "pvp", "$", "ars", "usd"];
const CURRENCY_KEYWORDS = ["moneda", "currency", "curr", "divisa"];
const CODE_KEYWORDS = ["codigo", "cÃ³digo", "cod", "sku", "ean", "upc", "ref", "referencia"];

const PDF_IGNORE_PATTERNS = [
  /^(pagina|p[aÃ¡]gina)\s+\d+$/i,
  /^pm materiales el[eÃ©]ctricos$/i,
  /^pablo molise$/i,
  /^contactos?:?$/i,
  /^neto$/i,
  /^nuevo$/i,
  /^producto$/i,
  /^s\/stock$/i,
];
const PDF_CATALOG_HINTS = ["codigo", "cÃ³digo", "precio", "u$s", "usd", "ars", "neto", "descuento"];
const PDF_TECHNICAL_HINTS = ["voltaje", "rpm", "prof.", "altura", "base", "a cm", "b cm", "c cm", "pulg."];
const PDF_TECHNICAL_PREFIXES = [
  /^caracter[iÃ­]sticas?:/i,
  /^datos t[eÃ©]cnicos?:/i,
  /^carga /i,
  /^contactos?:?$/i,
  /^programaci[oÃ³]n/i,
  /^tiempo m[iÃ­]nimo/i,
  /^alimentaci[oÃ³]n/i,
  /^modo(s)? de operaci[oÃ³]n/i,
  /^control de /i,
  /^pantalla /i,
  /^funci[oÃ³]n /i,
  /^registro /i,
  /^\*/i,
];

export function sanitizeHeaderRow(rawHeaders: string[]): string[] {
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

export function normalizeCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return String(value).replace(/\u00A0/g, " ").trim();
}

export function isLikelyDate(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) return false;
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(normalized)) return true;
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(normalized)) return true;
  return false;
}

export function parseFlexibleNumber(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;
  let normalized = value
    .replace(/\s+/g, "")
    .replace(/[\u00A0\u202F]/g, "")
    .replace(/[$â‚¬Â£Â¥]/g, "")
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

export function looksLikeHeaderRow(row: string[]): boolean {
  const nonEmpty = row.map((cell) => cell.trim()).filter(Boolean);
  if (nonEmpty.length < 2) return false;
  const alphaCells = nonEmpty.filter((cell) => /[a-zA-ZÃ¡Ã©Ã­Ã³ÃºÃ±]/i.test(cell)).length;
  const numericCells = nonEmpty.filter((cell) => parseFlexibleNumber(cell) !== null).length;
  return alphaCells >= 2 && numericCells <= Math.floor(nonEmpty.length / 2);
}

export function fillMergedCells(matrix: string[][], merges: MergeRange[] | undefined): string[][] {
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

export function getActiveColumns(row: string[]): number {
  return row.filter((cell) => cell.trim().length > 0).length;
}

function isSectionLikeRow(row: string[]): boolean {
  const nonEmpty = row.filter((cell) => cell.trim().length > 0);
  if (nonEmpty.length <= 1) return true;
  const numeric = nonEmpty.filter((cell) => parseFlexibleNumber(cell) !== null).length;
  return numeric === 0 && nonEmpty.join(" ").length > 30;
}

export function detectBlocks(rows: string[][]): Array<{ start: number; end: number }> {
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

export function detectCurrency(rawValue: string, fallback: "ARS" | "USD"): string {
  if (/u\$s|us\$|usd/i.test(rawValue)) return "USD";
  if (/ars|\$/i.test(rawValue)) return "ARS";
  return fallback;
}

export function isLikelySupplierCodeValue(value: string): boolean {
  const normalized = value.trim();
  if (!normalized || normalized.length > 24) return false;
  if (/\s{2,}/.test(normalized)) return false;
  if (/^(pagina|p[aÃ¡]gina|descuento|neto|contactos?|caracteristicas?|caracterÃ­sticas)$/i.test(normalized)) return false;
  if (/^[A-Za-z]+$/.test(normalized) && normalized !== normalized.toUpperCase()) return false;
  return /^[A-Z0-9][A-Z0-9\-_/+.()]{1,23}$/i.test(normalized);
}

export function isLikelyPdfNoiseValue(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) return true;
  return /@|tel|cel|p[aÃ¡]gina|descuento|neto|pmmateriales/i.test(normalized);
}

export function isLikelyStatusValue(value: string): boolean {
  return /^(s\/stock|disponible|nuevo|producto)$/i.test(value.trim());
}

export function isLikelyPriceValue(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) return false;
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(normalized)) return false;
  if (/^\d[\d\s-]{5,}$/.test(normalized) && !/[.,]\d{2}\b/.test(normalized)) return false;
  if (/[a-zA-Z]/.test(normalized) && !/u\$s|us\$|usd|ars|\$/i.test(normalized) && !/\d[.,]\d{2}\b/.test(normalized)) return false;
  const parsed = parseFlexibleNumber(normalized);
  if (parsed === null || parsed <= 0) return false;
  if (/u\$s|us\$|usd|ars|\$/i.test(normalized)) return true;
  if (/\d[.,]\d{2}\b/.test(normalized)) return true;
  if (/\d{1,3}(?:[.,]\d{3})+[.,]\d{2}\b/.test(normalized)) return true;
  return parsed >= 100;
}

export function pickPdfPriceCell(
  row: string[],
  preferredIndex: number | undefined,
  preferPrice: "first" | "last",
): { index: number; raw: string; value: number } | null {
  const orderedIndexes = Array.from({ length: row.length }, (_, idx) => idx);
  if (preferPrice === "last") orderedIndexes.reverse();
  if (preferredIndex !== undefined) {
    const withoutPreferred = orderedIndexes.filter((idx) => idx !== preferredIndex);
    orderedIndexes.splice(0, orderedIndexes.length, preferredIndex, ...withoutPreferred);
  }
  for (const index of orderedIndexes) {
    const raw = String(row[index] ?? "").trim();
    if (!isLikelyPriceValue(raw)) continue;
    const value = parseFlexibleNumber(raw);
    if (value === null || value <= 0) continue;
    return { index, raw, value };
  }
  return null;
}

export function buildPdfDescriptionFromRow(
  row: string[],
  descriptionIndex: number,
  codeIndex: number | undefined,
  priceIndex: number | undefined,
): string {
  const primary = String(row[descriptionIndex] ?? "").replace(/\s+/g, " ").trim();
  const joined = row
    .map((cell, index) => ({ index, value: String(cell ?? "").replace(/\s+/g, " ").trim() }))
    .filter(({ value }) => value.length > 0)
    .filter(({ index }) => index !== priceIndex)
    .filter(({ index, value }) => !(index === codeIndex && isLikelySupplierCodeValue(value)))
    .filter(({ value }) => !isLikelyStatusValue(value))
    .filter(({ value }) => !isLikelyPriceValue(value))
    .filter(({ value }) => !isLikelyPdfNoiseValue(value))
    .map(({ value }) => value)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (joined.length >= Math.max(8, primary.length)) return joined;
  return primary;
}

const CATALOG_IMPORT_DICTIONARIES = {
  DESCRIPTION_KEYWORDS,
  PRICE_KEYWORDS,
  CURRENCY_KEYWORDS,
  CODE_KEYWORDS,
  PDF_IGNORE_PATTERNS,
  PDF_CATALOG_HINTS,
  PDF_TECHNICAL_HINTS,
  PDF_TECHNICAL_PREFIXES,
};
