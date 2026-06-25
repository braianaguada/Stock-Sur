import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadHtmlAsPdf } from "./download-html-pdf";

const saveMock = vi.fn();
const fromMock = vi.fn();
const setMock = vi.fn();

vi.mock("html2pdf.js", () => ({
  default: () => ({
    set: setMock.mockImplementation(() => ({
      from: fromMock.mockImplementation(() => ({ save: saveMock })),
    })),
  }),
}));

describe("downloadHtmlAsPdf", () => {
  afterEach(() => {
    saveMock.mockReset();
    fromMock.mockClear();
    setMock.mockClear();
    document.body.innerHTML = "";
  });

  it("aísla los estilos de impresión de los estilos globales", async () => {
    document.head.innerHTML = '<style id="app-style">.app{color:oklch(1 0 0)}</style>';
    saveMock.mockResolvedValue(undefined);

    await downloadHtmlAsPdf(
      '<html><head><style>.sheet{color:#111827}</style></head><body><main class="sheet">PDF</main></body></html>',
      "presupuesto",
    );

    const options = setMock.mock.calls[0][0];
    const clonedDocument = document.implementation.createHTMLDocument();
    clonedDocument.head.innerHTML = `
      <link rel="stylesheet" href="/app.css">
      <style>.app{color:oklch(1 0 0)}</style>
      <style data-pdf-print-style="true">.sheet{color:#111827}</style>
    `;

    options.html2canvas.onclone(clonedDocument);

    expect(clonedDocument.querySelector('link[rel="stylesheet"]')).toBeNull();
    expect(clonedDocument.querySelector("style:not([data-pdf-print-style])")).toBeNull();
    expect(clonedDocument.querySelector('[data-pdf-print-style="true"]')).not.toBeNull();
    expect(fromMock).toHaveBeenCalledOnce();
    expect(document.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it("limpia el contenedor aunque falle la generación", async () => {
    saveMock.mockImplementation(async () => {
      const leakedContainer = document.createElement("iframe");
      leakedContainer.className = "html2canvas-container";
      document.body.appendChild(leakedContainer);
      throw new Error("fallo PDF");
    });

    await expect(downloadHtmlAsPdf("<html><body>PDF</body></html>", "presupuesto"))
      .rejects.toThrow("fallo PDF");

    expect(document.querySelector(".html2canvas-container")).toBeNull();
    expect(document.querySelector('[aria-hidden="true"]')).toBeNull();
  });
});
