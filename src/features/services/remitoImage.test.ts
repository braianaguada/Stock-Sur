import { describe, expect, it } from "vitest";
import { resolveServiceRemitoFileType } from "./remitoImage";

describe("resolveServiceRemitoFileType", () => {
  it("accepts a PDF reported by the browser", () => {
    expect(resolveServiceRemitoFileType({ name: "12661 - 1115.pdf", type: "application/pdf" })).toBe("application/pdf");
  });

  it("infers PDF from its extension when Windows omits the MIME type", () => {
    expect(resolveServiceRemitoFileType({ name: "12661 - 1115.PDF", type: "" })).toBe("application/pdf");
  });

  it("rejects unsupported files", () => {
    expect(resolveServiceRemitoFileType({ name: "remito.docx", type: "application/octet-stream" })).toBeNull();
  });
});
