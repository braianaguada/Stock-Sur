import { describe, expect, it } from "vitest";
import { buildMailtoLink } from "@/lib/email";

describe("buildMailtoLink", () => {
  it("returns null when the email is missing", () => {
    expect(buildMailtoLink({ to: "" })).toBeNull();
    expect(buildMailtoLink({ to: null })).toBeNull();
  });

  it("builds a mailto link with subject and body", () => {
    const link = buildMailtoLink({
      to: "proveedor@example.com",
      subject: "Pedido",
      body: "Linea 1\nLinea 2",
    });

    expect(link).toBe("mailto:proveedor%40example.com?subject=Pedido&body=Linea+1%0ALinea+2");
  });
});
