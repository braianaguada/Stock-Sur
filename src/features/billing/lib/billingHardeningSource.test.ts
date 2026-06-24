import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("billing preproduction hardening source layout", () => {
  it("keeps fiscal settings in Settings and the billing page operational", () => {
    const billingPage = readFileSync("src/pages/Billing.tsx", "utf8");
    const settingsPage = readFileSync("src/pages/Settings.tsx", "utf8");

    expect(settingsPage).toContain("BillingFiscalSettingsSection");
    expect(settingsPage).toContain("useBillingDiagnostics");
    expect(settingsPage).toContain("billing-fiscal-settings");

    expect(billingPage).not.toContain("BillingFiscalSettingsSection");
    expect(billingPage).not.toContain("Guardar configuracion");
    expect(billingPage).not.toContain("billing-new-pos");
  });
});
