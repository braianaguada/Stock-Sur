import { describe, expect, it } from "vitest";
import fs from "node:fs";

const migration = fs.readFileSync("supabase/migrations/20260604120000_customer_fiscal_profiles.sql", "utf8");

describe("customer fiscal profile migration", () => {
  it("scopes profiles by company and prevents duplicate profile per customer", () => {
    expect(migration).toContain("unique (company_id, customer_id)");
    expect(migration).toContain("on public.customer_fiscal_profiles(company_id, tax_id)");
    expect(migration).toContain("public.is_company_member(auth.uid(), company_id)");
  });

  it("prevents raw secrets in validation snapshots at the database boundary", () => {
    expect(migration).toContain("validation_snapshot jsonb");
    expect(migration).not.toMatch(/AFIPSDK_ACCESS_TOKEN|Bearer [A-Za-z0-9]/);
  });
});
