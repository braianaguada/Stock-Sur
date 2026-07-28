import { describe, expect, it } from "vitest";
import {
  buildSupplierFormState,
  buildSupplierOrderMessage,
  createEmptySupplierForm,
  selectSupplierCatalogVersionId,
} from "@/features/suppliers/state";
import type { SupplierCatalogVersion } from "@/features/suppliers/types";

describe("supplier form state", () => {
  it("keeps phone and WhatsApp as independent values", () => {
    const form = buildSupplierFormState({
      id: "supplier-1",
      name: "PM Materiales",
      legal_name: "PM Materiales SA",
      tax_id: "30712345678",
      contact_name: "Ana",
      email: "pm@example.com",
      phone: "2994000000",
      whatsapp: "2994111111",
      address: "Ruta 22",
      default_currency: "ARS",
      notes: null,
      is_active: true,
    });

    expect(form.phone).toBe("2994000000");
    expect(form.whatsapp).toBe("2994111111");
    expect(form).not.toHaveProperty("default_currency");
  });

  it("starts optional procurement fields empty", () => {
    expect(createEmptySupplierForm()).toMatchObject({
      legal_name: "",
      tax_id: "",
      phone: "",
      address: "",
    });
  });
});

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
        legal_name: null,
        tax_id: null,
        address: null,
        default_currency: null,
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

describe("selectSupplierCatalogVersionId", () => {
  const version = (
    id: string,
    importedAt: string,
  ): SupplierCatalogVersion => ({
    id,
    catalog_id: "catalog-1",
    title: id,
    imported_at: importedAt,
    supplier_document_id: `document-${id}`,
    file_name: `${id}.pdf`,
    file_type: "pdf",
    line_count: 1,
  });

  it("selects the latest version independently of the response order", () => {
    expect(selectSupplierCatalogVersionId([
      version("version-old", "2026-01-10T10:00:00.000Z"),
      version("version-new", "2026-03-10T10:00:00.000Z"),
      version("version-middle", "2026-02-10T10:00:00.000Z"),
    ], null)).toBe("version-new");
  });

  it("keeps a current version only while it belongs to the loaded supplier", () => {
    const versions = [
      version("version-new", "2026-03-10T10:00:00.000Z"),
      version("version-old", "2026-01-10T10:00:00.000Z"),
    ];

    expect(selectSupplierCatalogVersionId(versions, "version-old")).toBe("version-old");
    expect(selectSupplierCatalogVersionId(versions, "version-other-supplier")).toBe("version-new");
  });

  it("uses the id as deterministic tie breaker and clears an empty history", () => {
    const importedAt = "2026-03-10T10:00:00.000Z";

    expect(selectSupplierCatalogVersionId([
      version("version-a", importedAt),
      version("version-b", importedAt),
    ], null)).toBe("version-b");
    expect(selectSupplierCatalogVersionId([], "version-old")).toBeNull();
  });
});
