import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20260610120000_document_recipient_guards.sql", "utf8");
const hardeningMigration = readFileSync("supabase/migrations/20260613143000_harden_internal_remito_guards.sql", "utf8");
const serviceCustomerGuardMigration = readFileSync("supabase/migrations/20260616120000_service_document_customer_guards.sql", "utf8");

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

describe("internal remito database hardening", () => {
  it("rejects every incompatible internal remito state before issue side effects", () => {
    expect(hardeningMigration).toContain("new.technician_id is null");
    expect(hardeningMigration).toContain("new.internal_remito_type is null");
    expect(hardeningMigration).toContain("new.customer_id is not null");
    expect(hardeningMigration).toContain("new.payment_terms is not null");
    expect(hardeningMigration).toContain("new.service_id is not null");
  });

  it("blocks account and fiscal documents for internal remitos", () => {
    expect(hardeningMigration).toContain("v_doc.customer_kind = 'INTERNO' or v_doc.customer_id is null");
    expect(hardeningMigration).toContain("Los remitos internos no generan comprobantes fiscales");
  });
});

describe("service document customer database guards", () => {
  it("requires service remitos to use the same registered customer", () => {
    expect(serviceCustomerGuardMigration).toContain("new.doc_type <> 'REMITO'");
    expect(serviceCustomerGuardMigration).toContain("new.customer_kind = 'INTERNO'");
    expect(serviceCustomerGuardMigration).toContain("new.customer_id is null");
    expect(serviceCustomerGuardMigration).toContain("v_service_customer_id is null");
    expect(serviceCustomerGuardMigration).toContain("v_service_customer_id <> new.customer_id");
    expect(serviceCustomerGuardMigration).toContain("customer.is_occasional");
  });

  it("reruns service guards when customer identity changes", () => {
    expect(serviceCustomerGuardMigration).toContain("before insert or update of service_id, doc_type, company_id, customer_id, customer_kind");
    expect(serviceCustomerGuardMigration).toContain("payment_terms, service_id, status, company_id");
  });
});
