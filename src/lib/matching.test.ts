import { describe, expect, it } from "vitest";
import { matchImportLine, normalizeText } from "./matching";

describe("normalizeText", () => {
  it("normaliza acentos, símbolos y espacios para texto AR", () => {
    expect(normalizeText("  CAÑO   1/2\"  ÁCERO+inox. ")).toBe("cano 1 2 acero inox");
  });

  it("colapsa espacios y limpia caracteres no alfanuméricos", () => {
    expect(normalizeText("MÓDULO---eléctrico   #220V")).toBe("modulo electrico 220v");
  });
});

describe("matchImportLine", () => {
  const aliases = [
    { item_id: "item-1", alias: "ABC-123", is_supplier_code: true },
    { item_id: "item-1", alias: "válvula esférica", is_supplier_code: false },
    { item_id: "item-2", alias: "valvula", is_supplier_code: false },
    { item_id: "item-3", alias: "tv", is_supplier_code: false },
  ];

  it("prioriza supplier_code exacto", () => {
    const result = matchImportLine({
      supplierCode: "abc 123",
      rawDescription: "Otro texto",
      aliases,
    });

    expect(result).toEqual({ itemId: "item-1", reason: "SUPPLIER_CODE" });
  });

  it("hace token match por palabra completa normalizada", () => {
    const result = matchImportLine({
      supplierCode: "",
      rawDescription: "VÁLVULA esférica de 1 pulgada",
      aliases,
    });

    expect(result).toEqual({ itemId: "item-1", reason: "ALIAS_TOKEN" });
  });

  it("hace contains match no ambiguo para alias largos", () => {
    const result = matchImportLine({
      supplierCode: "",
      rawDescription: "repuesto para valvula esferica premium",
      aliases: [{ item_id: "item-1", alias: "esferica", is_supplier_code: false }],
    });

    expect(result).toEqual({ itemId: "item-1", reason: "ALIAS_CONTAINS" });
  });

  it("evita contains ambiguo", () => {
    const result = matchImportLine({
      supplierCode: "",
      rawDescription: "filtro valvula industrial",
      aliases: [
        { item_id: "item-1", alias: "valvula", is_supplier_code: false },
        { item_id: "item-2", alias: "valvula", is_supplier_code: false },
      ],
    });

    expect(result).toEqual({ itemId: null, reason: "NONE" });
  });

  it("ignora aliases cortos", () => {
    const result = matchImportLine({
      supplierCode: "",
      rawDescription: "televisor smart",
      aliases,
    });

    expect(result).toEqual({ itemId: null, reason: "NONE" });
  });
});
