import { loadXlsx } from "@/lib/lazy-vendors";

export type ExcelCell = string | number | null;
export type SupplierSheet = { name: string; rows: ExcelCell[][]; hiddenRows?: number[] };
export type PriceFormat = "comma" | "dot";
export type ImportCurrency = "ARS" | "USD";
export type SupplierColumnMapping = { name: number; unit: number | null; price: number };
export type SupplierPreviewRow = {
  row: number;
  name: string;
  unit: string;
  priceText: string;
  price: number | null;
  errors: string[];
};

export const MAX_IMPORT_ROWS = 20000;

export async function readSupplierExcel(file: File): Promise<SupplierSheet[]> {
  if (!/\.xlsx?$/i.test(file.name)) throw new Error("Seleccioná un archivo Excel .xlsx o .xls.");
  if (file.size > 20 * 1024 * 1024) throw new Error("El Excel supera el máximo de 20 MB.");
  const xlsx = await loadXlsx();
  const workbook = xlsx.read(await file.arrayBuffer(), { type: "array", cellDates: false, cellStyles: true });
  const sheets = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    if (!sheet["!ref"]) return { name, rows: [] };
    const range = xlsx.utils.decode_range(sheet["!ref"]);
    if (range.e.r > MAX_IMPORT_ROWS || range.e.c > 255) {
      throw new Error(`La hoja «${name}» supera el máximo de ${MAX_IMPORT_ROWS} filas de datos o 256 columnas. Dividí el archivo antes de cargarlo.`);
    }
    const rows = xlsx.utils.sheet_to_json<ExcelCell[]>(sheet, {
      header: 1, raw: true, defval: null, blankrows: true, range: 0,
    });
    // An uncached formula must be reviewed, never mistaken for an empty cell/default unit.
    for (const address of Object.keys(sheet)) {
      if (address.startsWith("!")) continue;
      const cell = sheet[address];
      if (cell.f && cell.v == null) {
        const position = xlsx.utils.decode_cell(address);
        rows[position.r] ??= [];
        rows[position.r][position.c] = "#FÓRMULA SIN RESULTADO";
      } else if (cell.t === "e" || cell.t === "b") {
        const position = xlsx.utils.decode_cell(address);
        rows[position.r] ??= [];
        rows[position.r][position.c] = "#CELDA INVÁLIDA";
      }
    }
    return { name, rows, hiddenRows: (sheet["!rows"] ?? []).flatMap((row, index) => row?.hidden ? [index + 1] : []) };
  });
  if (!sheets.some((sheet) => sheet.rows.length > 0)) throw new Error("El Excel no contiene datos.");
  return sheets;
}

export function parseSupplierPrice(value: ExcelCell | undefined, format: PriceFormat, currency: ImportCurrency): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 && value <= Number.MAX_SAFE_INTEGER ? value : null;
  let text = String(value ?? "").trim();
  const currencyPrefix = text.match(/^(US\$|U\$S|USD|ARS|\$)\s*/i);
  if (currencyPrefix) {
    const prefix = currencyPrefix[1].toUpperCase();
    if ((prefix === "ARS" && currency !== "ARS") || (["USD", "US$", "U$S"].includes(prefix) && currency !== "USD")) return null;
    text = text.slice(currencyPrefix[0].length);
  }
  const pattern = format === "comma"
    ? /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/
    : /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;
  if (!pattern.test(text)) return null;
  const number = Number(format === "comma" ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, ""));
  return Number.isFinite(number) && number > 0 && number <= Number.MAX_SAFE_INTEGER ? number : null;
}

export function previewSupplierSheet(sheet: SupplierSheet, headerRow: number, mapping: SupplierColumnMapping, format: PriceFormat, currency: ImportCurrency): SupplierPreviewRow[] {
  const columns = [mapping.name, mapping.price, ...(mapping.unit === null ? [] : [mapping.unit])];
  if (columns.some((column) => column < 0 || !Number.isInteger(column)) || new Set(columns).size !== columns.length) {
    throw new Error("Elegí columnas distintas para nombre, unidad y precio.");
  }
  if (!Number.isInteger(headerRow) || headerRow < 1 || headerRow > sheet.rows.length) throw new Error("Indicá una fila de encabezados válida.");
  return sheet.rows.slice(headerRow).flatMap((cells, index) => {
    if (sheet.hiddenRows?.includes(headerRow + index + 1)) return [];
    if (cells.every((cell) => cell == null || String(cell).trim() === "")) return [];
    const name = String(cells[mapping.name] ?? "").trim();
    const unit = mapping.unit === null ? "unidad" : String(cells[mapping.unit] ?? "").trim() || "unidad";
    const price = parseSupplierPrice(cells[mapping.price], format, currency);
    const errors = [];
    const invalidCells = ["#FÓRMULA SIN RESULTADO", "#CELDA INVÁLIDA"];
    if (!name || invalidCells.includes(name)) errors.push("Falta un nombre válido");
    if (invalidCells.includes(unit)) errors.push("Unidad inválida");
    if (price === null) errors.push("El precio debe ser mayor a cero y coincidir con el formato y la moneda elegidos");
    return [{ row: headerRow + index + 1, name, unit, priceText: String(cells[mapping.price] ?? ""), price, errors }];
  });
}
