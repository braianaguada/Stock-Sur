import { describe, expect, it } from "vitest";
import { enhanceRemitoImage, isSupportedServiceRemitoFile, readFunctionError } from "./remitoImage";

describe("service remito files", () => {
  it.each(["image/jpeg", "image/png", "image/webp", "application/pdf"])("accepts %s", (type) => {
    expect(isSupportedServiceRemitoFile(new File(["content"], "remito", { type }))).toBe(true);
  });

  it("rejects unsupported file types", () => {
    expect(isSupportedServiceRemitoFile(new File(["content"], "remito.txt", { type: "text/plain" }))).toBe(false);
  });

  it("does not try to enhance PDF files as images", async () => {
    await expect(enhanceRemitoImage(new File(["content"], "remito.pdf", { type: "application/pdf" }))).resolves.toBeNull();
  });
});

describe("readFunctionError", () => {
  it("returns the safe message produced by an edge function", async () => {
    const error = { context: new Response(JSON.stringify({ error: "El modelo configurado no está disponible." })) };

    await expect(readFunctionError(error)).resolves.toBe("El modelo configurado no está disponible.");
  });

  it("falls back to the original error message", async () => {
    await expect(readFunctionError(new Error("Network error"))).resolves.toBe("Network error");
  });
});
