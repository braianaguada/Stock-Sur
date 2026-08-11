import { describe, expect, it } from "vitest";
import { readFunctionError } from "./remitoImage";

describe("readFunctionError", () => {
  it("returns the safe message produced by an edge function", async () => {
    const error = { context: new Response(JSON.stringify({ error: "El modelo configurado no está disponible." })) };

    await expect(readFunctionError(error)).resolves.toBe("El modelo configurado no está disponible.");
  });

  it("falls back to the original error message", async () => {
    await expect(readFunctionError(new Error("Network error"))).resolves.toBe("Network error");
  });
});
