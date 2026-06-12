import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20260610120000_document_recipient_guards.sql", "utf8");

describe("document recipient database guards", () => {
  it("normalizes internal remitos before issue side effects", () => {
    expect(migration).toContain("before insert or update");
    expect(migration).toContain("if new.doc_type <> 'REMITO'");
    expect(migration).toContain("new.customer_id := null");
    expect(migration).toContain("new.payment_terms := null");
    expect(migration).toContain("new.service_id := null");
  });

  it("blocks invalid registered-company and service relationships", () => {
    expect(migration).toContain("new.customer_kind = 'EMPRESA' and new.customer_id is null");
    expect(migration).toContain("v_service_customer_id is distinct from new.customer_id");
  });
});
