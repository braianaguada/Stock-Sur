import { describe, expect, it } from "vitest";
import { DOC_LABEL, DOC_TYPE_CLASS } from "./constants";

describe("document type compatibility", () => {
  it("includes REMITO_DEVOLUCION labels and styles", () => {
    expect(DOC_LABEL.REMITO_DEVOLUCION).toBe("Devolucion de remito");
    expect(DOC_TYPE_CLASS.REMITO_DEVOLUCION).toContain("amber");
  });
});
