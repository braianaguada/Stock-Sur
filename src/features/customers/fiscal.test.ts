import { describe, expect, it, vi } from "vitest";
import {
  buildCustomerFiscalSnapshot,
  canUseCustomerForInvoiceA,
  isValidCuitChecksum,
  isValidCuitFormat,
  normalizeCuit,
} from "./fiscal";
import type { Customer, CustomerFiscalProfile } from "./types";

const customer: Customer = {
  id: "customer-1",
  company_id: "company-1",
  name: "Cliente SA",
  cuit: "20-40937847-2",
  email: null,
  phone: null,
  is_occasional: false,
};

const profile: CustomerFiscalProfile = {
  id: "profile-1",
  company_id: "company-1",
  customer_id: "customer-1",
  tax_id: "20409378472",
  legal_name: "Cliente SA",
  tax_condition: "RESPONSABLE_INSCRIPTO",
  fiscal_address: "Calle 123",
  validation_status: "VALIDATED",
  validation_source: "AFIPSDK_WS_SR_CONSTANCIA_INSCRIPCION",
  validation_error: null,
  validation_snapshot: { ok: true },
  validated_at: "2026-06-04T12:00:00Z",
  created_by: "user-1",
  updated_by: "user-1",
  created_at: "2026-06-04T12:00:00Z",
  updated_at: "2026-06-04T12:00:00Z",
};

describe("customer fiscal profile helpers", () => {
  it("normalizes CUIT and validates format/checksum", () => {
    expect(normalizeCuit("20-40937847-2")).toBe("20409378472");
    expect(isValidCuitFormat("20409378472")).toBe(true);
    expect(isValidCuitFormat("2040937847")).toBe(false);
    expect(isValidCuitFormat("letras")).toBe(false);
    expect(isValidCuitChecksum("20-40937847-2")).toBe(true);
    expect(isValidCuitChecksum("20-40937847-3")).toBe(false);
  });

  it("blocks customers that are not valid for future Factura A", () => {
    expect(canUseCustomerForInvoiceA({ ...customer, is_occasional: true }, profile)).toMatchObject({ allowed: false });
    expect(canUseCustomerForInvoiceA(customer, null)).toMatchObject({ allowed: false });
    expect(canUseCustomerForInvoiceA(customer, { ...profile, tax_condition: null })).toMatchObject({ allowed: false });
    expect(canUseCustomerForInvoiceA(customer, { ...profile, validation_status: "ERROR" })).toMatchObject({ allowed: false });
  });

  it("allows a non occasional customer with a validated complete fiscal profile", () => {
    expect(canUseCustomerForInvoiceA(customer, profile)).toEqual({ allowed: true, reasons: [] });
  });

  it("builds fiscal snapshot for future billing documents", () => {
    vi.setSystemTime(new Date("2026-06-04T13:00:00Z"));
    expect(buildCustomerFiscalSnapshot(customer, profile)).toEqual({
      customer_id: "customer-1",
      legal_name: "Cliente SA",
      tax_id: "20409378472",
      tax_condition: "RESPONSABLE_INSCRIPTO",
      fiscal_address: "Calle 123",
      validation_status: "VALIDATED",
      validated_at: "2026-06-04T12:00:00Z",
      snapshot_created_at: "2026-06-04T13:00:00.000Z",
    });
    vi.useRealTimers();
  });
});
