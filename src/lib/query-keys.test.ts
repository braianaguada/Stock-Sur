import { describe, expect, it } from "vitest";
import { queryKeys } from "@/lib/query-keys";

describe("company scoped query keys", () => {
  it("scopes company settings by company", () => {
    expect(queryKeys.company.settings("company-1")).toEqual(["company-settings", "company-1"]);
    expect(queryKeys.company.settings(null)).toEqual(["company-settings", "no-company"]);
  });

  it("scopes import price-list options by company", () => {
    expect(queryKeys.imports.priceLists("company-1")).toEqual([
      "imports-price-lists",
      "company-1",
    ]);
    expect(queryKeys.imports.priceLists(null)).toEqual(["imports-price-lists", "no-company"]);
  });

  it("scopes document detail, lines and events by company", () => {
    expect(queryKeys.documents.detail("company-1", "doc-1")).toEqual(["documents", "detail", "company-1", "doc-1"]);
    expect(queryKeys.documents.lines("company-1", "doc-1")).toEqual(["document-lines", "company-1", "doc-1"]);
    expect(queryKeys.documents.events("company-1", "doc-1")).toEqual(["document-events", "company-1", "doc-1"]);
  });

  it("scopes cash linked document reads by company", () => {
    expect(queryKeys.cash.linkedDocument("company-1", "doc-1")).toEqual(["cash-linked-document", "company-1", "doc-1"]);
    expect(queryKeys.cash.linkedDocumentLines("company-1", "doc-1")).toEqual(["cash-linked-document-lines", "company-1", "doc-1"]);
    expect(queryKeys.cash.linkedDocumentEvents("company-1", "doc-1")).toEqual(["cash-linked-document-events", "company-1", "doc-1"]);
  });

  it("scopes billing and service document details by company", () => {
    expect(queryKeys.billing.lines("company-1", "billing-1")).toEqual(["billing-document-lines", "company-1", "billing-1"]);
    expect(queryKeys.serviceDocuments.detail("company-1", "service-1")).toEqual(["service-document", "company-1", "service-1"]);
    expect(queryKeys.serviceDocuments.lines("company-1", "service-1")).toEqual(["service-document-lines", "company-1", "service-1"]);
    expect(queryKeys.serviceDocuments.attachments("company-1", "service-1")).toEqual(["service-document-attachments", "company-1", "service-1"]);
    expect(queryKeys.serviceDocuments.shareLinks("company-1", "service-1")).toEqual(["service-document-share-links", "company-1", "service-1"]);
    expect(queryKeys.serviceDocuments.events("company-1", "service-1")).toEqual(["service-document-events", "company-1", "service-1"]);
  });

  it("scopes settlement list, detail, lines and totals by company", () => {
    expect(queryKeys.settlements.list("company-1")).toEqual(["settlements", "list", "company-1"]);
    expect(queryKeys.settlements.detail("company-1", "settlement-1")).toEqual(["settlements", "detail", "company-1", "settlement-1"]);
    expect(queryKeys.settlements.lines("company-1", "settlement-1")).toEqual(["settlements", "lines", "company-1", "settlement-1"]);
    expect(queryKeys.settlements.totals("company-1", "settlement-1")).toEqual(["settlements", "totals", "company-1", "settlement-1"]);
    expect(queryKeys.settlements.list(null)).toEqual(["settlements", "list", "no-company"]);
  });

  it("scopes technician lists and material control dependencies by company", () => {
    expect(queryKeys.technicians.dailyBoard("company-1", "2026-08-13")).toEqual([
      "technicians", "company-1", "daily-board", "2026-08-13",
    ]);
    expect(queryKeys.technicians.list("company-1", "ana", "active")).toEqual([
      "technicians",
      "company-1",
      "list",
      "ana",
      "active",
    ]);
    expect(queryKeys.technicians.materialControl.documents("company-1", "2026-07-01", "2026-07-31")).toEqual([
      "technicians",
      "company-1",
      "material-control",
      "documents",
      "2026-07-01",
      "2026-07-31",
    ]);
    expect(queryKeys.technicians.materialControl.lines("company-1", "doc-1,doc-2")).toEqual([
      "technicians",
      "company-1",
      "material-control",
      "lines",
      "doc-1,doc-2",
    ]);
    expect(queryKeys.technicians.materialControl.services("company-2", "service-1")).toEqual([
      "technicians",
      "company-2",
      "material-control",
      "services",
      "service-1",
    ]);
    expect(queryKeys.technicians.materialControl.lines(null, "")).toEqual([
      "technicians",
      "no-company",
      "material-control",
      "lines",
      "",
    ]);
  });

  it("scopes supplier lists and catalog history by company and supplier", () => {
    expect(queryKeys.suppliers.company("company-1")).toEqual(["suppliers", "company-1"]);
    expect(queryKeys.suppliers.list("company-1", "valvula", "active")).toEqual([
      "suppliers",
      "company-1",
      "valvula",
      "active",
    ]);
    expect(queryKeys.suppliers.catalogs("company-1", "supplier-1")).toEqual([
      "supplier-catalogs",
      "company-1",
      "supplier-1",
    ]);
    expect(queryKeys.suppliers.catalogVersions("company-1", "supplier-1")).toEqual([
      "supplier-catalog-versions",
      "company-1",
      "supplier-1",
    ]);
    expect(queryKeys.suppliers.catalogLinesVersion("company-1", "version-1")).toEqual([
      "supplier-catalog-lines",
      "company-1",
      "version-1",
    ]);
    expect(queryKeys.suppliers.company(null)).toEqual(["suppliers", "no-company"]);
  });
});
