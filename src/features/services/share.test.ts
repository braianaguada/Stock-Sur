import { describe, expect, it } from "vitest";
import { buildMailtoUrl, buildServiceDocumentShareMessage, buildWhatsAppUrl, normalizeWhatsAppNumber, sanitizePdfFileName } from "./share";
import type { ServiceDocument } from "./types";

const document = {
  number: 7,
  total: 850,
  currency: "USD",
  exchange_rate: 1250,
  customers: { name: "Cliente QA" },
} as ServiceDocument;

describe("service document sharing", () => {
  it("normalizes basic Argentina WhatsApp numbers", () => {
    expect(normalizeWhatsAppNumber("+54 9 299 123-4567")).toBe("5492991234567");
    expect(normalizeWhatsAppNumber("0299 1234567")).toBe("542991234567");
    expect(normalizeWhatsAppNumber("")).toBe("");
  });

  it("builds WhatsApp and email URLs with encoded link messages", () => {
    const message = buildServiceDocumentShareMessage(document, "https://stock-sur.test/public/service-document/token");
    expect(message).toContain("SERV-000007");
    expect(message).toContain("USD");
    expect(message).toContain("Cotizacion Banco Nacion");
    expect(message).toContain("https://stock-sur.test/public/service-document/token");

    expect(buildWhatsAppUrl({ phone: "", message })).toContain("https://wa.me/?text=");
    expect(buildMailtoUrl({ email: "qa@example.com", subject: "Presupuesto", body: message })).toContain("mailto:qa%40example.com?");
  });

  it("sanitizes PDF file names", () => {
    expect(sanitizePdfFileName("Cliente / QA: Sur")).toBe("Cliente-QA-Sur");
  });
});
