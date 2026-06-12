import { describe, expect, it } from "vitest";
import { PRINT_FAVICON_TAG, withPrintFavicon } from "./print";

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
