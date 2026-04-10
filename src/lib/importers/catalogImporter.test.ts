import { describe, expect, it } from "vitest";
import {
  detectColumnsHeuristic,
  detectPdfColumnsHeuristic,
  normalizePdfRowsToLines,
  normalizeRowsToLines,
  parseFlexibleNumber,
  shouldRetryPdfWithOcr,
} from "@/lib/importers/catalogImporter";

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

  it("detects PDF columns and rebuilds rows with shifted prices", () => {
    const headers = ["col_1", "col_2", "col_3", "col_4", "col_5"];
    const rows = [
      ["750-9-220", "AC3 9A 1Na 220 Vca", "", "", "$ 13,077.02"],
      ["750-12-220", "AC3 12A 1Na 220 Vca", "", "", "$ 13,850.42"],
      ["MM1D5-45", "Multimedidor monofasico", "", "U$S 30.83", ""],
      ["", "PABLO MOLISE", "", "", "TEL 4504-9474"],
    ];

    const detected = detectPdfColumnsHeuristic(headers, rows);
    expect(detected.descriptionColumn).toBe("col_2");
    expect(detected.codeColumn).toBe("col_1");

    const lines = normalizePdfRowsToLines({
      headers,
      rows,
      mapping: {
        descriptionColumn: detected.descriptionColumn,
        priceColumn: detected.priceColumn,
        codeColumn: detected.codeColumn,
        preferPriceAtEnd: true,
        filterRowsWithoutPrice: true,
      },
      defaultCurrency: "ARS",
    });

    expect(lines).toHaveLength(3);
    expect(lines[0].supplier_code).toBe("750-9-220");
    expect(lines[0].cost).toBeCloseTo(13077.02, 2);
    expect(lines[2].currency).toBe("USD");
    expect(lines[2].cost).toBeCloseTo(30.83, 2);
  });

  it("filters technical rows and ignores non-product PDF noise", () => {
    const headers = ["col_1", "col_2", "col_3", "col_4"];
    const rows = [
      ["CODIGO", "PULG.", "A cm", "B cm"],
      ["DCR-6", "6", "15", "12"],
      ["SL12WF", "Aplique cerrado blanco 12w Luz blanca fría", "", "U$S 3.60"],
      ["NETO", "", "", ""],
    ];

    const lines = normalizePdfRowsToLines({
      headers,
      rows,
      mapping: {
        descriptionColumn: "col_2",
        priceColumn: "col_4",
        codeColumn: "col_1",
        preferPriceAtEnd: true,
        filterRowsWithoutPrice: true,
      },
      defaultCurrency: "ARS",
    });

    expect(lines).toHaveLength(1);
    expect(lines[0].supplier_code).toBe("SL12WF");
    expect(lines[0].raw_description).toContain("Aplique cerrado blanco 12w");
  });

  it("retries OCR when text extraction quality is poor even if the PDF has enough text", () => {
    expect(
      shouldRetryPdfWithOcr(
        {
          chars: 2200,
          lines: [
            {
              supplier_code: "A1",
              raw_description: "Cable",
              normalized_description: "cable",
              cost: 1000,
              currency: "ARS",
              row_index: 1,
            },
            {
              supplier_code: "A2",
              raw_description: "Mouse",
              normalized_description: "mouse",
              cost: 2000,
              currency: "ARS",
              row_index: 2,
            },
          ],
          tableRows: [
            ["promo vigente"],
            ["sku"],
            ["precio"],
            ["telefono"],
            ["direccion"],
          ],
        },
        {
          preferPrice: "last",
          defaultCurrency: "ARS",
          maxPages: 30,
          textThresholdChars: 500,
          maxOcrMs: 120000,
        },
      ),
    ).toBe(true);
  });

  it("keeps text mode when extracted rows already look healthy", () => {
    expect(
      shouldRetryPdfWithOcr(
        {
          chars: 3200,
          lines: [
            {
              supplier_code: "A1",
              raw_description: "Cable HDMI 2 metros mallado",
              normalized_description: "cable hdmi 2 metros mallado",
              cost: 1000,
              currency: "ARS",
              row_index: 1,
            },
            {
              supplier_code: "A2",
              raw_description: "Mouse inalambrico recargable",
              normalized_description: "mouse inalambrico recargable",
              cost: 2000,
              currency: "ARS",
              row_index: 2,
            },
            {
              supplier_code: "A3",
              raw_description: "Teclado mecanico compacto",
              normalized_description: "teclado mecanico compacto",
              cost: 3000,
              currency: "ARS",
              row_index: 3,
            },
            {
              supplier_code: "A4",
              raw_description: "Auriculares bluetooth plegables",
              normalized_description: "auriculares bluetooth plegables",
              cost: 4000,
              currency: "ARS",
              row_index: 4,
            },
            {
              supplier_code: "A5",
              raw_description: "Monitor led 24 pulgadas",
              normalized_description: "monitor led 24 pulgadas",
              cost: 5000,
              currency: "ARS",
              row_index: 5,
            },
            {
              supplier_code: "A6",
              raw_description: "Webcam full hd con microfono",
              normalized_description: "webcam full hd con microfono",
              cost: 6000,
              currency: "ARS",
              row_index: 6,
            },
            {
              supplier_code: "A7",
              raw_description: "Parlante portatil resistente al agua",
              normalized_description: "parlante portatil resistente al agua",
              cost: 7000,
              currency: "ARS",
              row_index: 7,
            },
            {
              supplier_code: "A8",
              raw_description: "Disco solido externo 1tb",
              normalized_description: "disco solido externo 1tb",
              cost: 8000,
              currency: "ARS",
              row_index: 8,
            },
            {
              supplier_code: "A9",
              raw_description: "Adaptador usb c multipuerto",
              normalized_description: "adaptador usb c multipuerto",
              cost: 9000,
              currency: "ARS",
              row_index: 9,
            },
            {
              supplier_code: "A10",
              raw_description: "Base notebook aluminio regulable",
              normalized_description: "base notebook aluminio regulable",
              cost: 10000,
              currency: "ARS",
              row_index: 10,
            },
          ],
          tableRows: [
            ["A1", "Cable HDMI 2 metros mallado", "$ 1.000,00"],
            ["A2", "Mouse inalambrico recargable", "$ 2.000,00"],
            ["A3", "Teclado mecanico compacto", "$ 3.000,00"],
            ["A4", "Auriculares bluetooth plegables", "$ 4.000,00"],
            ["A5", "Monitor led 24 pulgadas", "$ 5.000,00"],
          ],
        },
        {
          preferPrice: "last",
          defaultCurrency: "ARS",
          maxPages: 30,
          textThresholdChars: 500,
          maxOcrMs: 120000,
        },
      ),
    ).toBe(false);
  });
});
