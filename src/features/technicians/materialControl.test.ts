import { describe, expect, it } from "vitest";
import { buildMaterialControlReport, getDocumentControlUrl, type MaterialControlDocument, type MaterialControlLine } from "./materialControl";

const documents: MaterialControlDocument[] = [
  {
    id: "remito-1",
    doc_type: "REMITO",
    status: "EMITIDO",
    point_of_sale: 1,
    document_number: 12,
    issue_date: "2026-05-10",
    technician_id: "tech-1",
    customer_id: "customer-1",
    customer_name: "Cliente Norte",
    service_id: "service-1",
    origin_document_id: null,
    source_document_id: null,
    source_document_number_snapshot: null,
    external_invoice_number: "FAC-99",
    total: 1800,
    created_at: "2026-05-10T12:00:00Z",
  },
  {
    id: "return-1",
    doc_type: "REMITO_DEVOLUCION",
    status: "EMITIDO",
    point_of_sale: 1,
    document_number: 3,
    issue_date: "2026-05-12",
    technician_id: "tech-1",
    customer_id: "customer-1",
    customer_name: "Cliente Norte",
    service_id: "service-1",
    origin_document_id: "remito-1",
    source_document_id: null,
    source_document_number_snapshot: null,
    external_invoice_number: null,
    total: 450,
    created_at: "2026-05-12T12:00:00Z",
  },
];

const lines: MaterialControlLine[] = [
  {
    id: "line-1",
    document_id: "remito-1",
    item_id: "item-1",
    description: "Cable UTP",
    sku_snapshot: "CAB-UTP",
    quantity: 10,
    unit_price: 100,
    line_total: 1000,
    base_cost_snapshot: 60,
  },
  {
    id: "line-2",
    document_id: "remito-1",
    item_id: "item-2",
    description: "Ficha RJ45",
    sku_snapshot: "RJ45",
    quantity: 5,
    unit_price: 100,
    line_total: 0,
    base_cost_snapshot: 50,
  },
  {
    id: "line-3",
    document_id: "return-1",
    item_id: "item-1",
    description: "Cable UTP",
    sku_snapshot: "CAB-UTP",
    quantity: 4,
    unit_price: 100,
    line_total: 400,
    base_cost_snapshot: 60,
  },
];

function buildReport(overrides: Partial<Parameters<typeof buildMaterialControlReport>[0]> = {}) {
  return buildMaterialControlReport({
    documents,
    lines,
    technicians: [{ id: "tech-1", name: "Juan Tecnico" }],
    services: [{ id: "service-1", title: "Instalacion", job_id: "job-1", jobTitle: "Trabajo Norte", customerName: "Cliente Norte" }],
    filters: { technicianId: "ALL", customerId: "ALL", serviceId: "ALL", type: "ALL", search: "" },
    ...overrides,
  });
}

describe("buildMaterialControlReport", () => {
  it("counts REMITO as Entrega and REMITO_DEVOLUCION as Devolucion", () => {
    const report = buildReport();

    expect(report.movements.map((movement) => movement.movementType).sort()).toEqual(["Devolucion", "Entrega"]);
    expect(report.totals.remitos).toBe(1);
    expect(report.totals.devoluciones).toBe(1);
  });

  it("calculates material value from lines and commercial total from documents.total", () => {
    const report = buildReport();
    const remito = report.movements.find((movement) => movement.documentId === "remito-1");
    const devolucion = report.movements.find((movement) => movement.documentId === "return-1");

    expect(remito?.materialValue).toBe(1500);
    expect(remito?.commercialTotal).toBe(1800);
    expect(devolucion?.materialValue).toBe(400);
    expect(devolucion?.commercialTotal).toBe(450);
  });

  it("calculates estimated cost from base_cost_snapshot times quantity", () => {
    const report = buildReport();
    const remito = report.movements.find((movement) => movement.documentId === "remito-1");
    const devolucion = report.movements.find((movement) => movement.documentId === "return-1");

    expect(remito?.estimatedCost).toBe(850);
    expect(devolucion?.estimatedCost).toBe(240);
  });

  it("keeps material and commercial balances separated when document totals differ from lines", () => {
    const report = buildReport();

    expect(report.totals.materialDeliveredValue).toBe(1500);
    expect(report.totals.materialReturnedValue).toBe(400);
    expect(report.totals.materialBalance).toBe(1100);
    expect(report.totals.commercialDeliveredTotal).toBe(1800);
    expect(report.totals.commercialReturnedTotal).toBe(450);
    expect(report.totals.commercialBalance).toBe(1350);
    expect(report.totals.costDeliveredValue).toBe(850);
    expect(report.totals.costReturnedValue).toBe(240);
    expect(report.totals.costNetValue).toBe(610);
    expect(report.totals.grossMargin).toBe(740);
    expect(report.technicianSummaries[0].materialBalance).toBe(1100);
    expect(report.technicianSummaries[0].commercialBalance).toBe(1350);
    expect(report.technicianSummaries[0].costNetValue).toBe(610);
    expect(report.technicianSummaries[0].grossMargin).toBe(740);
  });

  it("keeps document totals and line values separated when they differ", () => {
    const report = buildReport();
    const summary = report.technicianSummaries[0];

    expect(summary.materialBalance).toBe(1100);
    expect(summary.commercialBalance).toBe(1350);
    expect(summary.commercialBalance).not.toBe(summary.materialBalance);
  });

  it("groups technician summary and material rows", () => {
    const report = buildReport();

    expect(report.technicianSummaries[0]).toMatchObject({
      technicianName: "Juan Tecnico",
      remitos: 1,
      devoluciones: 1,
      clients: 1,
      jobs: 1,
    });

    const materialRows = report.materialRowsByTechnician.get("tech-1") ?? [];
    expect(materialRows.find((row) => row.sku === "CAB-UTP")).toMatchObject({
      deliveredQuantity: 10,
      returnedQuantity: 4,
      netQuantity: 6,
      deliveredValue: 1000,
      returnedValue: 400,
      netValue: 600,
      deliveredCost: 600,
      returnedCost: 240,
      netCost: 360,
      grossMargin: 240,
    });
  });

  it("filters by technician, customer, type and material search", () => {
    expect(buildReport({ filters: { technicianId: "missing", customerId: "ALL", serviceId: "ALL", type: "ALL", search: "" } }).movements).toHaveLength(0);
    expect(buildReport({ filters: { technicianId: "ALL", customerId: "customer-1", serviceId: "ALL", type: "REMITO", search: "cable" } }).movements).toHaveLength(1);
  });

  it("keeps document links on document_id even when external invoice exists", () => {
    const report = buildReport();
    const remito = report.movements.find((movement) => movement.documentId === "remito-1");

    expect(remito?.externalInvoiceNumber).toBe("FAC-99");
    expect(remito?.documentUrl).toBe(getDocumentControlUrl("remito-1"));
    expect(remito?.documentUrl).toBe("/documents?document_id=remito-1");
  });
});
