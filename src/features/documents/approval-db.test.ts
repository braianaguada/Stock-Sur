import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20261016133000_budget_approval_invoker_lock.sql", "utf8");
describe("budget approval SQL safeguards (static)", () => {
  it("keeps RLS and tenant permissions, locks the source and reuses existing remitos", () => {
    expect(sql).toContain("security invoker");
    expect(sql).toContain("set search_path = public");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).not.toContain("for update");
    expect(sql).toContain("'documents.approve'");
    expect(sql).toContain("'documents.create'");
    expect(sql).toContain("company_id = v_source.company_id and source_document_id = v_source.id");
    expect(sql).toContain("if found then return v_target");
    expect(sql).toContain("from public, anon");
  });
  it("creates a draft without issuing stock or registering money", () => {
    expect(sql).toContain("'REMITO', 'BORRADOR'");
    expect(sql).toContain("public.transition_document_status(v_source.id, 'APROBADO')");
    expect(sql).not.toContain("issue_document(");
    expect(sql).not.toContain("insert into public.cash_");
    expect(sql).not.toContain("insert into public.stock_");
  });
});
