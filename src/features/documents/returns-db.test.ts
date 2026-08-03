import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260803120000_allow_commercial_remito_returns.sql",
  "utf8",
);

describe("commercial remito return migration", () => {
  it("accepts matching nullable technician associations without weakening tenant and origin guards", () => {
    expect(migration).toContain(
      "origin.technician_id is not distinct from v_doc.technician_id",
    );
    expect(migration).not.toContain("La devolucion debe estar asociada a un tecnico");
    expect(migration).toContain("origin.company_id = v_doc.company_id");
    expect(migration).toContain("origin.doc_type = 'REMITO'");
    expect(migration).toContain("origin.status = 'EMITIDO'");
    expect(migration).toContain("has_company_permission");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = public");
  });
});
