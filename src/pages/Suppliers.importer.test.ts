import { describe, expect, it } from "vitest";
import { detectColumnsHeuristic, normalizeRowsToLines, parseFlexibleNumber } from "@/lib/importers/catalogImporter";

describe("supplier importer heuristics", () => {
  it("detects description and price columns on common headers", () => {
    const headers = ["Codigo", "Descripcion", "Precio Lista"];
    const rows = [
      ["A1", "Cable HDMI 2m", "1.234,56"],
      ["A2", "Adaptador USB-C", "2450.90"],
      ["A3", "Mouse Inalambrico", "8500"],
    ];

    const detected = detectColumnsHeuristic(headers, rows);
    expect(detected.descriptionColumn).toBe("Descripcion");
    expect(detected.priceColumn).toBe("Precio Lista");
    expect(detected.confidence).toBeGreaterThan(0);
  });

  it("normalizes mixed numeric formats and filters invalid rows", () => {
    const { lines, diagnostics } = normalizeRowsToLines({
      headers: ["col_1", "col_2", "col_3"],
      rows: [
        ["SKU-01", "Producto Uno", "1.234,56"],
        ["SKU-02", "Producto Dos", "1,234.56"],
        ["", "", ""],
        ["SKU-03", "", "1500"],
        ["SKU-06", "Producto Seis", "abc"],
        ["SKU-04", "Producto Cuatro", "0"],
      ],
      mapping: {
        descriptionColumn: "col_2",
        priceColumn: "col_3",
        supplierCodeColumn: "col_1",
        currencyColumn: null,
      },
    });

    expect(lines).toHaveLength(2);
    expect(lines[0].cost).toBeCloseTo(1234.56, 2);
    expect(lines[1].cost).toBeCloseTo(1234.56, 2);
    expect(diagnostics.totalRows).toBe(6);
    expect(diagnostics.keptRows).toBe(2);
    expect(diagnostics.dropped_emptyRow).toBe(1);
    expect(diagnostics.dropped_missingDesc).toBe(1);
    expect(diagnostics.dropped_invalidPrice).toBe(1);
    expect(diagnostics.dropped_priceLE0).toBe(1);
    expect(diagnostics.sampleDropped.length).toBeGreaterThan(0);
  });

  it("parses flexible numbers", () => {
    expect(parseFlexibleNumber("$ 2.345,50")).toBeCloseTo(2345.5, 2);
    expect(parseFlexibleNumber("USD 1,200.75")).toBeCloseTo(1200.75, 2);
    expect(parseFlexibleNumber("")).toBeNull();
  });
});
