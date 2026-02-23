import { describe, expect, it } from "vitest";
import { isRowEmpty, normalizeNumberString, parseImportFile, parsePrice } from "@/lib/importParser";

describe("normalizeNumberString", () => {
  it("normaliza formatos con moneda, espacios y comas", () => {
    expect(normalizeNumberString(" $ 1.234,56 ")).toBe("1234.56");
    expect(normalizeNumberString("ARS\u00A01.234,56")).toBe("1234.56");
    expect(normalizeNumberString("1,234.56")).toBe("1234.56");
    expect(normalizeNumberString("12 345,00")).toBe("12345.00");
  });
});

describe("parsePrice", () => {
  it("parsea precios válidos y devuelve 0 para inválidos", () => {
    expect(parsePrice("$ 2.345,70")).toBeCloseTo(2345.7);
    expect(parsePrice("1,999.90")).toBeCloseTo(1999.9);
    expect(parsePrice("texto")).toBe(0);
    expect(parsePrice(" ")).toBe(0);
  });
});

describe("filas vacías", () => {
  it("detecta filas vacías", () => {
    expect(isRowEmpty({ a: "", b: "   " })).toBe(true);
    expect(isRowEmpty({ a: "SKU-1", b: "" })).toBe(false);
  });

  it("ignora filas vacías en parseo CSV", async () => {
    const file = new File(
      ["sku,description,price\nA1,Producto 1,10\n,,\n  ,  ,   \nA2,Producto 2,20"],
      "lista.csv",
      { type: "text/csv" },
    );

    const parsed = await parseImportFile(file);

    expect(parsed.headers).toEqual(["sku", "description", "price"]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].sku).toBe("A1");
    expect(parsed.rows[1].sku).toBe("A2");
  });
});
