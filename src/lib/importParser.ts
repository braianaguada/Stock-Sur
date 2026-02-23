import * as XLSX from "xlsx";

export interface ParsedRow {
  [key: string]: string;
}

const EMPTY_HEADER_PREFIX = "column_";

export function normalizeNumberString(value: string): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";

  let clean = trimmed
    .replace(/\s+/g, "")
    .replace(/[\u00A0\u202F]/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!clean) return "";

  const hasComma = clean.includes(",");
  const hasDot = clean.includes(".");

  if (hasComma && hasDot) {
    const lastComma = clean.lastIndexOf(",");
    const lastDot = clean.lastIndexOf(".");
    const decimalSeparator = lastComma > lastDot ? "," : ".";

    if (decimalSeparator === ",") {
      clean = clean.replace(/\./g, "").replace(",", ".");
    } else {
      clean = clean.replace(/,/g, "");
    }

    return clean;
  }

  if (hasComma) {
    const commaCount = (clean.match(/,/g) ?? []).length;
    if (commaCount > 1) {
      const parts = clean.split(",");
      const decimal = parts.pop() ?? "";
      clean = `${parts.join("")}.${decimal}`;
    } else {
      clean = clean.replace(",", ".");
    }
  }

  if (hasDot) {
    const dotCount = (clean.match(/\./g) ?? []).length;
    if (dotCount > 1) {
      const parts = clean.split(".");
      const decimal = parts.pop() ?? "";
      clean = `${parts.join("")}.${decimal}`;
    }
  }

  return clean;
}

export function parsePrice(value: string): number {
  const normalized = normalizeNumberString(value);
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isRowEmpty(row: ParsedRow): boolean {
  return Object.values(row).every((val) => !String(val ?? "").trim());
}

function sanitizeHeaders(rawHeaders: string[]): string[] {
  const used = new Set<string>();

  return rawHeaders.map((header, index) => {
    const base = (header ?? "").trim() || `${EMPTY_HEADER_PREFIX}${index + 1}`;

    if (!used.has(base)) {
      used.add(base);
      return base;
    }

    let suffix = 2;
    let candidate = `${base}_${suffix}`;
    while (used.has(candidate)) {
      suffix += 1;
      candidate = `${base}_${suffix}`;
    }

    used.add(candidate);
    return candidate;
  });
}

function normalizeRowValues(row: string[]): string[] {
  return row.map((value) => String(value ?? "").trim());
}

function buildRows(headers: string[], dataRows: string[][]): ParsedRow[] {
  return dataRows
    .map((rawRow) => {
      const values = normalizeRowValues(rawRow);
      const row: ParsedRow = {};
      headers.forEach((header, i) => {
        row[header] = values[i] ?? "";
      });
      return row;
    })
    .filter((row) => !isRowEmpty(row));
}


export async function parseImportFile(file: File): Promise<{ headers: string[]; rows: ParsedRow[] }> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (["xlsx", "xls"].includes(extension ?? "")) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error("El archivo XLSX no contiene hojas");

    const sheet = workbook.Sheets[firstSheetName];
    const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      raw: false,
      blankrows: false,
      defval: "",
    });

    if (matrix.length < 2) throw new Error("Archivo vacío o sin datos");

    const headers = sanitizeHeaders(matrix[0].map((h) => String(h ?? "")));
    const rows = buildRows(headers, matrix.slice(1).map((row) => row.map((v) => String(v ?? ""))));

    return { headers, rows };
  }

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("Archivo vacío o sin datos");

  const delimiter = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
  const matrix = lines.map((line) => line.split(delimiter).map((value) => value.replace(/^"|"$/g, "")));

  const headers = sanitizeHeaders(matrix[0]);
  const rows = buildRows(headers, matrix.slice(1));

  return { headers, rows };
}
