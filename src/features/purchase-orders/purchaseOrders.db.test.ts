import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260711210000_supplier_purchase_orders.sql"),
  "utf8",
).toLowerCase();

describe("supplier purchase order migration", () => {
  it("persists immutable commercial snapshots and separated currency totals", () => {
    expect(migration).toContain("supplier_name_snapshot");
    expect(migration).toContain("raw_description_snapshot");
    expect(migration).toContain("presentation_raw_snapshot");
    expect(migration).toContain("reference_unit_price_snapshot");
    expect(migration).toContain("totals_by_currency");
    expect(migration).toContain("group by l.currency");
  });

  it("creates the order atomically from server-owned catalog data", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("auth.uid()");
    expect(migration).toContain("has_company_permission");
    expect(migration).toContain("l.supplier_catalog_version_id = p_catalog_version_id");
    expect(migration).toContain("join public.supplier_catalog_lines l");
    expect(migration).toContain("productos repetidos");
  });

  it("enforces active-company tenant isolation and blocks direct writes", () => {
    expect(migration).toContain("c.status = 'active'");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke insert, update, delete, truncate");
    expect(migration).toContain("foreign key (company_id, purchase_order_id)");
  });
});
