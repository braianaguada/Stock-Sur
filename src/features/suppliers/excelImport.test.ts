import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseSupplierPrice, previewSupplierSheet, readSupplierExcel } from "./excelImport";

describe("supplier Excel prices", () => {
  it.each([
    ["1.234,56", "comma", "ARS", 1234.56],
    ["$ 1.234,56", "comma", "ARS", 1234.56],
    ["USD 1,234.56", "dot", "USD", 1234.56],
    [1234.56, "comma", "ARS", 1234.56],
    [1234.56, "dot", "USD", 1234.56],
    ["1.23", "comma", "ARS", null],
    ["1,23", "dot", "ARS", null],
    ["USD 100", "comma", "ARS", null],
    ["ARS 100", "comma", "USD", null],
    ["12 pesos", "comma", "ARS", null],
    ["100/200", "comma", "ARS", null],
    [0, "comma", "ARS", null],
    [-1, "comma", "ARS", null],
    [Infinity, "comma", "ARS", null],
    ["", "comma", "ARS", null],
  ] as const)("validates %s with %s separators and %s currency", (value, format, currency, expected) => {
    expect(parseSupplierPrice(value, format, currency)).toBe(expected);
  });
});

describe("supplier Excel preview", () => {
  it("maps the chosen columns, skips only empty rows and preserves physical row numbers and errors", () => {
    const rows = previewSupplierSheet({ name: "Lista", rows: [
      ["Lista octubre"], ["Precio", "Nombre", "Unidad"],
      ["1.234,56", "Cable", "metro"], [null, null, null],
      [100, "#10 Tornillo", ""], ["consultar", "Tuerca", null], [12, null, "caja"],
    ] }, 2, { name: 1, price: 0, unit: 2 }, "comma", "ARS");
    expect(rows.map((row) => [row.row, row.name, row.unit, row.price])).toEqual([
      [3, "Cable", "metro", 1234.56], [5, "#10 Tornillo", "unidad", 100],
      [6, "Tuerca", "unidad", null], [7, "", "caja", 12],
    ]);
    expect(rows[1].errors).toEqual([]);
    expect(rows[2].errors).toHaveLength(1);
    expect(rows[3].errors).toHaveLength(1);
  });
  it("defaults the absent unit column and refuses duplicated columns or invalid headers", () => {
    const sheet = { name: "Lista", rows: [["Nombre", "Precio"], ["Cable", 12]] };
    expect(previewSupplierSheet(sheet, 1, { name: 0, price: 1, unit: null }, "comma", "USD")[0].unit).toBe("unidad");
    expect(() => previewSupplierSheet(sheet, 1, { name: 0, price: 0, unit: null }, "comma", "USD")).toThrow(/distintas/);
    expect(() => previewSupplierSheet(sheet, 0, { name: 0, price: 1, unit: null }, "comma", "USD")).toThrow(/encabezados/);
  });
});

describe("supplier workbook reader", () => {
  async function workbookFile(bookType: "xlsx" | "xls") {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Portada"]]), "Portada");
    const sheet = XLSX.utils.aoa_to_sheet([["Nombre", "Precio", "Unidad"], ["Cable", 1234.56, "metro"], ["Tuerca", 25, null]]);
    sheet.C3 = { t: "n", f: "A99" }; // no cached result: must not silently become 'unidad'
    XLSX.utils.book_append_sheet(workbook, sheet, "Precios");
    const bytes = XLSX.write(workbook, { bookType, type: "array" });
    return { name: `precios.${bookType}`, size: bytes.byteLength, arrayBuffer: async () => bytes } as File;
  }
  it.each(["xlsx", "xls"] as const)("reads real %s sheets and numeric cells without locale conversion", async (type) => {
    const sheets = await readSupplierExcel(await workbookFile(type));
    expect(sheets.map((sheet) => sheet.name)).toEqual(["Portada", "Precios"]);
    expect(sheets[1].rows[1]).toEqual(["Cable", 1234.56, "metro"]);
  });
  it("blocks uncached formula units rather than defaulting them", async () => {
    const sheets = await readSupplierExcel(await workbookFile("xlsx"));
    const rows = previewSupplierSheet(sheets[1], 1, { name: 0, price: 1, unit: 2 }, "comma", "ARS");
    expect(rows[1].errors).toContain("Unidad inválida");
  });
  it("rejects unsupported files and oversized workbooks before parsing", async () => {
    await expect(readSupplierExcel({ name: "lista.pdf", size: 1 } as File)).rejects.toThrow(/Excel/);
    await expect(readSupplierExcel({ name: "lista.xlsx", size: 21 * 1024 * 1024 } as File)).rejects.toThrow(/20 MB/);
  });
});
