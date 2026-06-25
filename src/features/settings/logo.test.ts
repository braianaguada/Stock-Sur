import { describe, expect, it } from "vitest";
import { getVersionedPublicUrl, validateCompanyLogo } from "./logo";

describe("company logo", () => {
  it("versions the public URL so a replaced logo is not served from cache", () => {
    expect(getVersionedPublicUrl("https://example.com/company-logo.png", 123)).toBe(
      "https://example.com/company-logo.png?v=123",
    );
  });

  it("preserves existing query parameters", () => {
    expect(getVersionedPublicUrl("https://example.com/logo.svg?download=1", 123)).toBe(
      "https://example.com/logo.svg?download=1&v=123",
    );
  });

  it("rejects non-image files and images larger than 5 MB", () => {
    expect(validateCompanyLogo(new File(["text"], "logo.txt", { type: "text/plain" }))).toBe(
      "El archivo seleccionado debe ser una imagen.",
    );
    expect(
      validateCompanyLogo(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "logo.png", { type: "image/png" })),
    ).toBe("El logo no puede superar los 5 MB.");
  });
});
