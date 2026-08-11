import { describe, expect, it } from "vitest";
import { isRetryableFunctionError, readFunctionError } from "./remitoImage";

describe("readFunctionError", () => {
  it("returns the safe message produced by an edge function", async () => {
    const error = { context: new Response(JSON.stringify({ error: "El modelo configurado no está disponible." })) };

    await expect(readFunctionError(error)).resolves.toBe("El modelo configurado no está disponible.");
  });

  it("falls back to the original error message", async () => {
    await expect(readFunctionError(new Error("Network error"))).resolves.toBe("Network error");
  });
});

describe("isRetryableFunctionError", () => {
  it.each([408, 429, 500, 503])("retries transient HTTP status %s", (status) => {
    expect(isRetryableFunctionError({ context: new Response(null, { status }) })).toBe(true);
  });

  it.each([400, 401, 403, 422])("does not retry permanent HTTP status %s", (status) => {
    expect(isRetryableFunctionError({ context: new Response(null, { status }) })).toBe(false);
  });

  it("retries a network failure without an HTTP response", () => {
    expect(isRetryableFunctionError(new Error("Network error"))).toBe(true);
  });
});
