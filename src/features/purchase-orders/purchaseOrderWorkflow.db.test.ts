import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260714100000_supplier_purchase_orders_workflow.sql"),
  "utf8",
).toLowerCase();

describe("supplier purchase order workflow migration", () => {
  it("authorizes every write against the active company and supplier permission", () => {
    expect(migration.match(/auth\.uid\(\)/g)?.length).toBe(3);
    expect(migration.match(/c\.status = 'active'/g)?.length).toBe(3);
    expect(migration.match(/has_company_permission\(v_uid, p_company_id, 'suppliers\.edit'\)/g)?.length).toBe(3);
    expect(migration).toContain("o.id = p_order_id and o.company_id = p_company_id");
  });

  it("edits only complete draft line sets and recalculates server totals", () => {
    expect(migration).toContain("v_order.status <> 'draft'");
    expect(migration).toContain("v_existing_count <> jsonb_array_length(p_lines)");
    expect(migration).toContain("l.id = x.line_id and l.company_id = p_company_id");
    expect(migration).toContain("sum(l.line_total)");
    expect(migration).toContain("totals_by_currency = v_totals");
  });

  it("allows only draft-to-sent/cancelled and sent-to-cancelled transitions", () => {
    expect(migration).toContain("v_order.status = 'draft' and p_target_status in ('sent', 'cancelled')");
    expect(migration).toContain("v_order.status = 'sent' and p_target_status = 'cancelled'");
    expect(migration).not.toContain("'confirmed'");
  });

  it("deletes only locked drafts and exposes RPCs solely to authenticated users", () => {
    expect(migration.match(/for update/g)?.length).toBe(3);
    expect(migration).toContain("delete from public.supplier_purchase_orders");
    expect(migration).toContain("revoke all on function public.delete_supplier_purchase_order_draft");
    expect(migration).toContain("grant execute on function public.delete_supplier_purchase_order_draft");
  });
});
