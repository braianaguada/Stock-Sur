import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260713120000_atomic_item_base_cost_update.sql",
  "utf8",
).toLowerCase();

describe("atomic item base cost migration", () => {
  it("enforces effective company permission and item ownership", () => {
    expect(migration).toContain("has_company_permission(v_actor, p_company_id, 'price_lists.edit')");
    expect(migration).toContain("i.company_id = p_company_id");
    expect(migration).toContain("i.is_active");
  });

  it("locks the server value before writing history and cost", () => {
    expect(migration).toContain("for update");
    expect(migration).toContain("insert into public.item_pricing_base_history");
    expect(migration).toContain("previous_base_cost, new_base_cost");
    expect(migration).toContain("update public.item_pricing_base");
  });

  it("does not expose the security definer RPC publicly", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = public");
    expect(migration).toContain("revoke all on function public.update_item_base_cost");
    expect(migration).toContain("grant execute on function public.update_item_base_cost(uuid, uuid, numeric) to authenticated");
  });
});
