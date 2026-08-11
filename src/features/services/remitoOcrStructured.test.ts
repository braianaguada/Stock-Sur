import { describe, expect, it } from "vitest";
import type { ServiceCustomer } from "./types";
import { findImportedCustomerId, parseStructuredServiceRemito } from "./remitoOcr";

describe("parseStructuredServiceRemito", () => {
  it("maps only valid structured work items and preserves a global total", () => {
    expect(parseStructuredServiceRemito({
      reference: " Remito 0003 ",
      issueDate: "2014-11-26",
      globalTotal: 128400,
      items: [
        { description: " Consultoría y asesoría de asuntos penales ", quantity: 1, unit: "serv", unitPrice: 0 },
        { description: " ", quantity: 1, unit: "serv", unitPrice: 100 },
      ],
    })).toMatchObject({
      reference: "Remito 0003",
      issueDate: "2014-11-26",
      globalTotal: 128400,
      lines: [{ description: "Consultoría y asesoría de asuntos penales.", quantity: 1, unit_price: 0, line_type: "ITEM" }],
    });
  });

  it("drops malformed provider fields instead of inventing values", () => {
    expect(parseStructuredServiceRemito({ reference: 3, issueDate: "26/11/2014", globalTotal: "128400", items: [{ description: null }] }))
      .toEqual({ customerName: null, reference: "", issueDate: null, globalTotal: null, netTotal: null, taxRate: null, taxTotal: null, lines: [] });
  });

  it("preserves a detected net amount and tax breakdown", () => {
    expect(parseStructuredServiceRemito({ netTotal: 120000, taxRate: 7, taxTotal: 8400, globalTotal: 128400, items: [] }))
      .toMatchObject({ netTotal: 120000, taxRate: 7, taxTotal: 8400, globalTotal: 128400 });
  });

  it("classifies headings, normalizes casing and splits independent actions", () => {
    expect(parseStructuredServiceRemito({
      customerName: "CÁMARA GAS",
      globalTotal: 41800,
      netTotal: 0,
      taxRate: 0,
      taxTotal: 0,
      items: [
        { description: "REVISIÓN DE AA/CC SALA DE UPC", lineType: "TITLE" },
        {
          description: "SE ENCUENTRA PÉRDIDA DE GAS EN CONEXIÓN 3/8. SE PROCEDE AL REAJUSTE 3/8. NO SE HACE CARGO DE GAS R410.",
          quantity: 1,
          unit: "serv",
          unitPrice: 0,
        },
      ],
    })).toMatchObject({
      customerName: "CÁMARA GAS",
      globalTotal: 41800,
      netTotal: null,
      taxRate: null,
      taxTotal: null,
      lines: [
        { description: "Revisión de AA/CC sala de UPC.", line_type: "TITLE", quantity: null, unit: null, unit_price: null },
        { description: "Se encuentra pérdida de gas en conexión 3/8.", line_type: "ITEM" },
        { description: "Se procede al reajuste 3/8.", line_type: "ITEM" },
        { description: "No se hace cargo de gas R410.", line_type: "ITEM" },
      ],
    });
  });
});

describe("findImportedCustomerId", () => {
  const customers = [
    { id: "one", name: "Cámara Gas", active: true },
    { id: "two", name: "Cámara Patagónica", active: true },
  ] as ServiceCustomer[];

  it("returns an exact normalized customer match", () => {
    expect(findImportedCustomerId("CAMARA GAS", customers)).toBe("one");
  });

  it("does not guess when a partial name matches more than one customer", () => {
    expect(findImportedCustomerId("Cámara", customers)).toBeNull();
  });
});
