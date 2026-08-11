import { describe, expect, it } from "vitest";
import { parseStructuredServiceRemito } from "./remitoOcr";

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
      lines: [{ description: "Consultoría y asesoría de asuntos penales", quantity: 1, unit_price: 0, line_type: "ITEM" }],
    });
  });

  it("drops malformed provider fields instead of inventing values", () => {
    expect(parseStructuredServiceRemito({ reference: 3, issueDate: "26/11/2014", globalTotal: "128400", items: [{ description: null }] }))
      .toEqual({ reference: "", issueDate: null, globalTotal: null, lines: [] });
  });
});
