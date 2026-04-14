import { describe, expect, it } from "vitest";
import { cleanAiLines, scorePdfExtractionResult } from "@/features/suppliers/aiPdfExtraction";
import type { CatalogImportLine, ParsePdfResult } from "@/lib/importers/catalogImporter";

describe("supplier ai pdf extraction", () => {
  it("cleans residual noise and deduplicates extracted rows", () => {
    const lines: CatalogImportLine[] = [
      {
        supplier_code: "A1",
        raw_description: "Producto nuevo Cable HDMI................................",
        normalized_description: "producto nuevo cable hdmi",
        cost: 10,
        currency: "USD",
        row_index: 1,
        source_page: 2,
        confidence: 0.7,
      },
      {
        supplier_code: "A1",
        raw_description: "Cable HDMI",
        normalized_description: "cable hdmi",
        cost: 10,
        currency: "USD",
        row_index: 2,
        source_page: 2,
        confidence: 0.9,
      },
      {
        supplier_code: null,
        raw_description: "NETO",
        normalized_description: "neto",
        cost: 20,
        currency: "ARS",
        row_index: 3,
      },
    ];

    const cleaned = cleanAiLines(lines);

    expect(cleaned).toHaveLength(1);
    expect(cleaned[0].raw_description).toBe("Cable HDMI");
    expect(cleaned[0].confidence).toBe(0.9);
  });

  it("prefers stronger page/confidence coverage over optional paid providers", () => {
    const geminiResult: ParsePdfResult = {
      lines: [
        {
          supplier_code: "A1",
          raw_description: "Cable HDMI 2 metros",
          normalized_description: "cable hdmi 2 metros",
          cost: 10,
          currency: "USD",
          row_index: 1,
          source_page: 1,
          confidence: 0.92,
        },
        {
          supplier_code: "B2",
          raw_description: "Mouse inalambrico",
          normalized_description: "mouse inalambrico",
          cost: 20,
          currency: "USD",
          row_index: 2,
          source_page: 2,
          confidence: 0.91,
        },
      ],
      meta: {
        mode: "ai",
        totalChars: 40,
        parsedPages: 2,
        confidence: 0.9,
        provider: "gemini",
      },
      table: {
        headers: ["supplier_code", "description", "price", "currency"],
        rows: [
          ["A1", "Cable HDMI 2 metros", "10", "USD"],
          ["B2", "Mouse inalambrico", "20", "USD"],
        ],
        previewRows: [],
        sourceMode: "ai",
      },
    };

    const mistralResult: ParsePdfResult = {
      ...geminiResult,
      meta: {
        ...geminiResult.meta,
        provider: "mistral",
        confidence: 0.72,
      },
      lines: geminiResult.lines.map((line) => ({
        ...line,
        confidence: 0.68,
      })),
    };

    expect(scorePdfExtractionResult(geminiResult)).toBeGreaterThan(scorePdfExtractionResult(mistralResult));
  });
});
