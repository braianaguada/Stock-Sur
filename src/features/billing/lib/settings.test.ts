import { describe, expect, it } from "vitest";
import { isValidCuitFormat, normalizeCuit } from "@/lib/cuit";
import { buildDisableBillingSettingsPayload, buildEnableBillingSettingsPayload, canShowBillingSettingsToggle } from "./settings";

describe("billing settings controls", () => {
  it("builds the internal enable payload without fiscal credentials", () => {
    expect(buildEnableBillingSettingsPayload("company-1")).toEqual({
      company_id: "company-1",
      provider: "AFIPSDK",
      environment: "dev",
      default_currency: "ARS",
      default_concept: "PRODUCTS",
      credentials_status: "NOT_CONFIGURED",
      is_enabled: true,
    });
  });

  it("builds the disable payload without deleting billing data", () => {
    expect(buildDisableBillingSettingsPayload()).toEqual({ is_enabled: false });
  });

  it("shows the settings toggle only to admins or billing.settings users", () => {
    expect(canShowBillingSettingsToggle(["user"], { companyPermissionCodes: ["billing.settings"] })).toBe(true);
    expect(canShowBillingSettingsToggle(["user"], { companyRoleCodes: ["admin"] })).toBe(true);
    expect(canShowBillingSettingsToggle(["admin"], { companyPermissionCodes: [] })).toBe(true);
    expect(canShowBillingSettingsToggle(["user"], { companyPermissionCodes: ["billing.view"] })).toBe(false);
  });

  it("normalizes CUIT by removing separators and non numeric characters", () => {
    expect(normalizeCuit("20-40937847-2")).toBe("20409378472");
    expect(normalizeCuit(" CUIT 20 40937847 2 ")).toBe("20409378472");
  });

  it("validates the minimal 11 digit CUIT format", () => {
    expect(isValidCuitFormat("20409378472")).toBe(true);
    expect(isValidCuitFormat("")).toBe(false);
    expect(isValidCuitFormat("2040937847")).toBe(false);
    expect(isValidCuitFormat("CUIT")).toBe(false);
    expect(isValidCuitFormat("12345678901")).toBe(true);
  });
});
