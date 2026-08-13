import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260813180000_technician_daily_board.sql"),
  "utf8",
);

describe("technician daily board database contract", () => {
  it("keeps one company-scoped state per technician and day", () => {
    expect(migration).toContain("unique (company_id, technician_id, business_date)");
    expect(migration).toContain("v_technician_company_id <> new.company_id");
    expect(migration).toContain("v_service_company_id <> new.company_id");
    expect(migration).toContain("new.created_by := old.created_by");
  });

  it("enforces RLS and existing technician permissions", () => {
    expect(migration).toContain("alter table public.technician_daily_statuses enable row level security");
    expect(migration).toContain("has_company_permission(auth.uid(), company_id, 'customers.view')");
    expect(migration.match(/has_company_permission\(auth\.uid\(\), company_id, 'customers\.edit'\)/g)?.length).toBe(4);
  });
});
