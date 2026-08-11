import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("service document customer transition guard", () => {
  it("blocks sent and approved documents without a customer in the database", () => {
    const migration = readFileSync("supabase/migrations/20260811090000_service_document_transition_customer_guard.sql", "utf8");
    expect(migration).toContain("new.status in ('SENT', 'APPROVED')");
    expect(migration).toContain("new.customer_id is null");
    expect(migration).toContain("before insert or update of status, customer_id");
  });
});
