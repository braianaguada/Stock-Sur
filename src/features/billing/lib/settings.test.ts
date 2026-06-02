import { describe, expect, it } from "vitest";
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
});
