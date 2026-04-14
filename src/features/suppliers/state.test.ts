import { describe, expect, it } from "vitest";
import { buildSupplierOrderMessage } from "@/features/suppliers/state";

describe("buildSupplierOrderMessage", () => {
  it("includes currency and unit cost for each line", () => {
    const message = buildSupplierOrderMessage({
      selectedSupplier: {
        id: "supplier-1",
        name: "PM Materiales",
        contact_name: null,
        email: "pm@example.com",
        phone: null,
        whatsapp: null,
        notes: null,
        is_active: true,
      },
      orderLines: [
        {
          id: "line-1",
          supplier_code: "A1",
          raw_description: "Cable HDMI",
          cost: 1234.5,
          currency: "ARS",
          quantity: 2,
        },
        {
          id: "line-2",
          supplier_code: "B2",
          raw_description: "Contactor",
          cost: 8.75,
          currency: "USD",
          quantity: 3,
        },
      ],
      activeVersion: {
        id: "version-1",
        catalog_id: "catalog-1",
        title: "Lista Marzo",
        imported_at: "2026-03-17T10:00:00.000Z",
        supplier_document_id: "doc-1",
        file_name: "lista.pdf",
        file_type: "pdf",
        line_count: 2,
      },
      catalogTitleById: new Map([["catalog-1", "PM Marzo"]]),
    });

    expect(message).toContain("A1 - Cable HDMI x 2 - ARS 1.234,50");
    expect(message).toContain("B2 - Contactor x 3 - USD 8,75");
  });
});
