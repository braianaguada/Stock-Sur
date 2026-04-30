import { afterEach, describe, expect, it, vi } from "vitest";
import { buildInitialServiceDocumentForm, canConvertServiceDocumentToRemito, canTransitionServiceDocument } from "./logic";

describe("service document logic", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds the initial form with company defaults", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T12:00:00.000Z"));

    const form = buildInitialServiceDocumentForm({
      document_tagline: "Intro de empresa",
      document_footer: "Cierre de empresa",
      service_default_intro_text: "Intro default",
      service_default_closing_text: "Cierre default",
      service_default_delivery_time: "48 hs",
      service_default_payment_terms: "Contado",
      service_default_delivery_location: "Sucursal central",
      service_default_valid_days: 10,
      address: "Av. Principal 123",
    });

    expect(form.issue_date).toBe("2026-04-29");
    expect(form.valid_until).toBe("2026-05-09");
    expect(form.intro_text).toBe("Intro de empresa");
    expect(form.closing_text).toBe("Cierre default");
    expect(form.delivery_time).toBe("48 hs");
    expect(form.payment_terms).toBe("Contado");
    expect(form.delivery_location).toBe("Sucursal central");
    expect(form.currency).toBe("ARS");
    expect(form.status).toBe("DRAFT");
  });

  it("uses the local date for new service documents", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 29, 23, 30, 0));

    const form = buildInitialServiceDocumentForm({ service_default_valid_days: 1 });

    expect(form.issue_date).toBe("2026-04-29");
    expect(form.valid_until).toBe("2026-04-30");
  });

  it("allows only the expected status transitions", () => {
    expect(canTransitionServiceDocument({ status: "DRAFT" }, "SENT")).toBe(true);
    expect(canTransitionServiceDocument({ status: "SENT" }, "APPROVED")).toBe(true);
    expect(canTransitionServiceDocument({ status: "APPROVED" }, "CANCELLED")).toBe(true);
    expect(canTransitionServiceDocument({ status: "APPROVED" }, "SENT")).toBe(false);
    expect(canTransitionServiceDocument({ status: "REJECTED" }, "APPROVED")).toBe(false);
    expect(canTransitionServiceDocument({ status: "CANCELLED" }, "DRAFT")).toBe(false);
  });

  it("only allows remito conversion from approved quotes", () => {
    expect(canConvertServiceDocumentToRemito({ type: "QUOTE", status: "APPROVED" })).toBe(true);
    expect(canConvertServiceDocumentToRemito({ type: "QUOTE", status: "SENT" })).toBe(false);
    expect(canConvertServiceDocumentToRemito({ type: "REMITO", status: "APPROVED" })).toBe(false);
  });

});
