import { describe, expect, it } from "vitest";
import { parseServiceRemitoText } from "./remitoOcr";

describe("parseServiceRemitoText", () => {
  it("extracts reference, date, service rows and a global total", () => {
    const result = parseServiceRemitoText(`N° 0003\nFECHA 26/11/2014\nCLIENTE Ministerio\nConsultoría y asesoría\nde asuntos penales\nTOTAL 128.400`);
    expect(result.reference).toBe("Remito 0003");
    expect(result.issueDate).toBe("2014-11-26");
    expect(result.lines.map((line) => line.description)).toEqual(["Consultoría y asesoría", "de asuntos penales"]);
    expect(result.globalTotal).toBe(128400);
  });

  it("keeps an explicit price on its item", () => {
    const result = parseServiceRemitoText("Remito 45\nReparación de motor $ 12.500");
    expect(result.lines[0]).toMatchObject({ description: "Reparación de motor", unit_price: 12500 });
  });
});
