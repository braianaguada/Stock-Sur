import { describe, expect, it } from "vitest";
import { queryKeys } from "@/lib/query-keys";

describe("company scoped query keys", () => {
  it("scopes company settings by company", () => {
    expect(queryKeys.company.settings("company-1")).toEqual(["company-settings", "company-1"]);
    expect(queryKeys.company.settings(null)).toEqual(["company-settings", "no-company"]);
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
});
