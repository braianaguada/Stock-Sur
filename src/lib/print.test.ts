import { describe, expect, it, vi } from "vitest";
import { PRINT_FAVICON_TAG, renderOptionalPrintMeta, withPrintFavicon, writePrintWindow } from "./print";

describe("withPrintFavicon", () => {
  it("adds the Stock Sur favicon to printable HTML", () => {
    expect(withPrintFavicon("<html><head><title>Documento</title></head><body /></html>"))
      .toContain(`${PRINT_FAVICON_TAG}</head>`);
  });

  it("does not duplicate an existing favicon", () => {
    const html = `<html><head>${PRINT_FAVICON_TAG}</head><body /></html>`;
    expect(withPrintFavicon(html)).toBe(html);
  });
});

describe("renderOptionalPrintMeta", () => {
  it.each([null, undefined, ""])("omits empty value %s", (value) => {
    expect(renderOptionalPrintMeta("Etiqueta", value)).toBe("");
  });

  it.each([
    [0, "0"],
    [false, "false"],
    [" ", " "],
  ])("preserves meaningful value %p", (value, renderedValue) => {
    expect(renderOptionalPrintMeta("Etiqueta", value)).toBe(
      `<div class="meta-line"><span>Etiqueta</span><strong>${renderedValue}</strong></div>`,
    );
  });

  it("escapes labels and values without changing the print markup", () => {
    expect(renderOptionalPrintMeta("<Tipo>", '"Servicio" & más')).toBe(
      '<div class="meta-line"><span>&lt;Tipo&gt;</span><strong>&quot;Servicio&quot; &amp; más</strong></div>',
    );
  });
});

describe("writePrintWindow", () => {
  it("reuses an already opened window for asynchronously prepared content", () => {
    const printWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      },
      focus: vi.fn(),
    } as unknown as Window;

    writePrintWindow(printWindow, "<html><head></head><body>Documento</body></html>");

    expect(printWindow.document.open).toHaveBeenCalledOnce();
    expect(printWindow.document.write).toHaveBeenCalledWith(
      expect.stringContaining("<body>Documento</body>"),
    );
    expect(printWindow.document.close).toHaveBeenCalledOnce();
    expect(printWindow.focus).toHaveBeenCalledOnce();
  });
});
