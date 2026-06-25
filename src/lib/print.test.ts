import { describe, expect, it } from "vitest";
import { PRINT_FAVICON_TAG, withPrintDialogOnLoad, withPrintFavicon } from "./print";

describe("withPrintFavicon", () => {
  it("adds the Stock Sur favicon to printable HTML", () => {
    expect(withPrintFavicon("<html><head><title>Documento</title></head><body /></html>"))
      .toContain(`${PRINT_FAVICON_TAG}</head>`);
  });

  it("does not duplicate an existing favicon", () => {
    const html = `<html><head>${PRINT_FAVICON_TAG}</head><body /></html>`;
    expect(withPrintFavicon(html)).toBe(html);
  });

  it("opens the browser print dialog after the printable document loads", () => {
    const html = withPrintDialogOnLoad("<html><head></head><body><main>Documento</main></body></html>");

    expect(html).toContain("window.addEventListener('load'");
    expect(html).toContain("window.print()");
    expect(html.indexOf("window.print()")).toBeLessThan(html.indexOf("</body>"));
  });
});
