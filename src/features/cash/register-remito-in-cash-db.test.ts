import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260713200000_register_remito_in_cash.sql",
  "utf8",
).replace(/\r\n/g, "\n");

describe("register remito in cash database contract", () => {
  it("enforces company permission and locks the remito in the active company", () => {
    expect(migration).toContain("has_company_permission(v_actor, p_company_id, 'cash.create')");
    expect(migration).toContain("where id = p_document_id\n    and company_id = p_company_id\n  for update");
    expect(migration).toContain("v_doc.doc_type <> 'REMITO' or v_doc.status <> 'EMITIDO'");
  });

  it("derives immutable sale data from the document and does not reopen a closure", () => {
    expect(migration).toContain("v_business_date := coalesce(");
    expect(migration).toContain("v_doc.total,");
    expect(migration).toContain("'COMPROBANTADA'");
    expect(migration).toContain("closure_id,");
    expect(migration).toContain("null,\n    v_actor");
  });

  it("is idempotent under concurrent requests without rewriting historical sales", () => {
    expect(migration).toContain("where id = p_document_id\n    and company_id = p_company_id\n  for update");
    expect(migration).toContain("cs.document_id = v_doc.id");
    expect(migration).toContain("btrim(cs.receipt_reference) = v_reference");
    expect(migration).toContain("return v_existing");
  });

  it("does not duplicate a document debit for cuenta corriente", () => {
    expect(migration).toContain("e.origin_type = 'DOCUMENT'");
    expect(migration).toContain("e.document_id = v_document_id");
    expect(migration).toContain("return new");
  });
});
