import { describe, expect, it } from "vitest";
import { normalizeCompanyIdentity, normalizeCompanySlug } from "@/features/users/utils";

describe("company identity form normalization", () => {
  it("uses the same canonical slug format for create and edit forms", () => {
    expect(normalizeCompanySlug("  Sucursal Núñez / Norte  ")).toBe("sucursal-nunez-norte");
    expect(normalizeCompanySlug("---Casa__Central---")).toBe("casa-central");
  });

  it("normalizes the submitted identity without changing the company name", () => {
    expect(
      normalizeCompanyIdentity({
        name: "  Sucursal Núñez  ",
        slug: " Sucursal Núñez ",
      }),
    ).toEqual({
      name: "Sucursal Núñez",
      slug: "sucursal-nunez",
    });
  });
});
