import { describe, expect, it } from "vitest";
import { DOC_LABEL } from "./constants";

describe("document type compatibility", () => {
  it("includes the REMITO_DEVOLUCION label", () => {
    expect(DOC_LABEL.REMITO_DEVOLUCION).toBe("Devolucion de remito");
  });
});
