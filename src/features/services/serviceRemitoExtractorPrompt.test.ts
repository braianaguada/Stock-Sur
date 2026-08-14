import { describe, expect, it } from "vitest";
import { serviceRemitoExtractionPrompt } from "../../../supabase/functions/service-remito-extractor/prompt";

describe("serviceRemitoExtractionPrompt", () => {
  it("separates independent remito concepts into distinct items", () => {
    expect(serviceRemitoExtractionPrompt).toContain("un item separado por cada trabajo o material independiente");
    expect(serviceRemitoExtractionPrompt).toContain("No agrupes en un mismo item conceptos");
    expect(serviceRemitoExtractionPrompt).toContain("devuelve igualmente un item por concepto");
    expect(serviceRemitoExtractionPrompt).not.toContain("No conviertas cada renglon visual en un item");
  });

  it("only joins lines that are a clear continuation of one description", () => {
    expect(serviceRemitoExtractionPrompt).toContain("solo cuando el segundo sea claramente la continuacion");
    expect(serviceRemitoExtractionPrompt).toContain("cantidad, unidad, precio, numeracion, viñeta");
  });
});
