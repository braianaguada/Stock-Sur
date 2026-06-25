import { describe, expect, it } from "vitest";
import { sanitizeFileName, sanitizeHtml } from "../../api/render-pdf";

describe("render PDF helpers", () => {
  it("removes active and embedded content from printable HTML", () => {
    const html = '<html><body onload="attack()"><script>attack()</script><iframe src="https://example.com"></iframe><embed src="file"></body></html>';
    const sanitized = sanitizeHtml(html);

    expect(sanitized).not.toContain("script");
    expect(sanitized).not.toContain("iframe");
    expect(sanitized).not.toContain("embed");
    expect(sanitized).not.toContain("onload");
  });

  it("returns a safe PDF filename", () => {
    expect(sanitizeFileName('Presupuesto: 12/3?.PDF')).toBe("Presupuesto- 12-3-.pdf");
  });
});
