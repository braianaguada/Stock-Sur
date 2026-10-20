import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20261020120000_automatic_price_list_calculation.sql", "utf8");
const functionSql = (name: string) => sql.split(`create or replace function public.${name}(`)[1].split("$$;")[0];

describe("automatic price list calculation migration", () => {
  it("calculates initial products and newly created lists from the current company cost", () => {
    for (const name of ["ensure_price_list_items_for_company_item", "seed_price_list_items_on_create"]) {
      const body = functionSql(name);
      expect(body).toContain("public.compute_price_list_value(coalesce(ipb.base_cost, 0)");
      expect(body).toContain("ipb.company_id =");
      expect(body).toContain("ipb.item_id =");
      expect(body).toContain("last_calculated_at");
      expect(body).not.toContain("    true\n  from");
    }
    expect(functionSql("ensure_price_list_items_for_company_item")).toContain("v_is_active is not true");
  });

  it("updates only the affected company product or list after costs and percentages change", () => {
    const cost = functionSql("mark_price_lists_pending_for_item_base_change");
    expect(cost).toContain("new.base_cost is not distinct from old.base_cost");
    expect(cost).toContain("pli.company_id = new.company_id and pli.item_id = new.item_id");
    expect(cost).toContain("pl.company_id = pli.company_id");
    const config = functionSql("mark_price_list_pending_on_config_change");
    expect(config).toContain("pli.price_list_id = new.id and pli.company_id = new.company_id");
    expect(config).toContain("ipb.company_id = pli.company_id and ipb.item_id = pli.item_id");
    for (const body of [cost, config]) {
      expect(body).toContain("needs_recalculation = false");
      expect(body).toContain("public.compute_price_list_value(");
      expect(body).not.toContain("'PENDING'");
    }
  });

  it("preserves manual prices, limits helper access and backfills pending snapshots atomically", () => {
    expect(sql).not.toMatch(/(?:final_price_override|manual_price_enabled)\s*=/);
    expect(sql).toContain("where price_list_items.company_id = excluded.company_id");
    expect(sql).toContain("revoke all on function public.ensure_price_list_items_for_company_item(uuid, uuid) from public, anon, authenticated");
    expect(sql).toContain("and pli.is_active = true and pli.needs_recalculation = true");
    expect(sql).toContain("begin;");
    expect(sql).toContain("commit;");
  });
});
