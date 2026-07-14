import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("documents confirmation architecture", () => {
  it("keeps critical document decisions inside the application UI", () => {
    const documentsPage = readFileSync("src/pages/Documents.tsx", "utf8");
    const previewDialog = readFileSync(
      "src/features/documents/components/DocumentsPreviewDialog.tsx",
      "utf8",
    );

    expect(documentsPage).not.toMatch(/window\.(confirm|prompt)/);
    expect(previewDialog).not.toMatch(/window\.(confirm|prompt)/);
    expect(documentsPage).toContain("DocumentConfirmationDialog");
    expect(documentsPage).toContain("Se registrara la salida de stock");
    expect(documentsPage).toContain("Se registrara el ingreso de stock");
    expect(previewDialog).toContain('htmlFor="external-invoice-number"');
    expect(previewDialog).toContain("DocumentConfirmationDialog");
  });
});
