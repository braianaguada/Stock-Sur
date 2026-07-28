import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260728120000_scope_price_list_pending_recalculation.sql",
  "utf8",
).toLowerCase();

describe("price list pending recalculation migration", () => {
  it("ignores base-cost writes without an effective value change", () => {
    expect(migration).toContain("tg_op = 'update'");
    expect(migration).toContain("new.base_cost is not distinct from old.base_cost");
  });

  it("marks every list product only when a pricing percentage changes", () => {
    expect(migration).toContain(
      "before update of flete_pct, utilidad_pct, impuesto_pct on public.price_lists",
    );
    expect(migration).toContain("old.flete_pct is distinct from new.flete_pct");
    expect(migration).toContain("old.utilidad_pct is distinct from new.utilidad_pct");
    expect(migration).toContain("old.impuesto_pct is distinct from new.impuesto_pct");
    expect(migration).not.toContain("before update of flete_pct, utilidad_pct, impuesto_pct, description, name");
  });

  it("keeps recalculation updates isolated to the active company and list", () => {
    expect(migration).toContain("where price_list_id = new.id");
    expect(migration).toContain("and company_id = new.company_id");
    expect(migration).toContain("and is_active = true");
    expect(migration).toContain("where pli.company_id = new.company_id");
    expect(migration).toContain("and pli.item_id = new.item_id");
    expect(migration).toContain("and pli.needs_recalculation = true");
    expect(migration).not.toContain(
      "(pli.needs_recalculation = true or pli.is_active = false)",
    );
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = public");
  });
});
