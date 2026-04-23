import { loadXlsx } from "@/lib/lazy-vendors";
import { isRowEmpty } from "@/lib/importParserCore";

const EMPTY_HEADER_PREFIX = "column_";

export { isRowEmpty, normalizeNumberString, parsePrice } from "@/lib/importParserCore";

async function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === "function") {
    return file.text();
  }
  if (typeof file.arrayBuffer === "function") {
    const buffer = await file.arrayBuffer();
    return new TextDecoder("utf-8").decode(buffer);
  }
  if (typeof FileReader !== "undefined") {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
      reader.readAsText(file as Blob);
    });
  }
  throw new Error("Entorno sin soporte para leer archivos de texto");
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
      headers.forEach((header, index) => {
        row[header] = values[index] ?? "";
      });
      return row;
    })
    .filter((row) => !isRowEmpty(row));
}

export async function parseImportFile(file: File): Promise<{ headers: string[]; rows: ParsedRow[] }> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (["xlsx", "xls"].includes(extension ?? "")) {
    const xlsx = await loadXlsx();
    const buffer = await file.arrayBuffer();
    const workbook = xlsx.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error("El archivo XLSX no contiene hojas");

    const sheet = workbook.Sheets[firstSheetName];
    const matrix = xlsx.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      raw: false,
      blankrows: false,
      defval: "",
    });

    if (matrix.length < 2) throw new Error("Archivo vacio o sin datos");

    const headers = sanitizeHeaders(matrix[0].map((header) => String(header ?? "")));
    const rows = buildRows(
      headers,
      matrix.slice(1).map((row) => row.map((value) => String(value ?? ""))),
    );

    return { headers, rows };
  }

  const text = await readFileAsText(file);
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("Archivo vacio o sin datos");

  const delimiter = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
  const matrix = lines.map((line) =>
    line.split(delimiter).map((value) => value.replace(/^"|"$/g, "")),
  );

  const headers = sanitizeHeaders(matrix[0]);
  const rows = buildRows(headers, matrix.slice(1));

  return { headers, rows };
}
