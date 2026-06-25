import { describe, expect, it } from "vitest";
import { buildDocumentShareMessage } from "./share";
import type { DocRow } from "./types";

const document = {
  doc_type: "PRESUPUESTO",
  document_number: 12,
  point_of_sale: 1,
  total: 12500,
} as DocRow;

describe("buildDocumentShareMessage", () => {
  it("incluye el enlace público y no indica que se solicite el PDF", () => {
    const message = buildDocumentShareMessage(document, "https://app.test/public/document/token");
    expect(message).toContain("https://app.test/public/document/token");
    expect(message).toContain("descargar el PDF");
    expect(message).not.toContain("solicitar");
  });
});
