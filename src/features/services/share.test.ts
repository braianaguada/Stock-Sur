import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildMailtoUrl,
  buildPublicServiceDocumentUrl,
  buildServiceDocumentShareMessage,
  buildWhatsAppUrl,
  normalizeWhatsAppNumber,
  sanitizePdfFileName,
} from "./share";
import type { ServiceDocument } from "./types";

const document = {
  number: 7,
  total: 850,
  currency: "USD",
  exchange_rate: 1250,
  customers: { name: "Cliente QA" },
} as ServiceDocument;

describe("service document sharing", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalizes basic Argentina WhatsApp numbers", () => {
    expect(normalizeWhatsAppNumber("+54 9 299 123-4567")).toBe("5492991234567");
    expect(normalizeWhatsAppNumber("0299 1234567")).toBe("542991234567");
    expect(normalizeWhatsAppNumber("")).toBe("");
  });

  it("builds public service document links from the configured public app URL", () => {
    vi.stubEnv("VITE_PUBLIC_APP_URL", "https://stock-sur.test/");

    expect(buildPublicServiceDocumentUrl("token con espacios")).toBe(
      "https://stock-sur.test/public/service-document/token%20con%20espacios",
    );
  });

  it("builds WhatsApp and email URLs with encoded link messages", () => {
    const message = buildServiceDocumentShareMessage(document, "https://stock-sur.test/public/service-document/token");
    expect(message).toContain("SERV-000007");
    expect(message).toContain("USD");
    expect(message).toContain("Cotizacion Banco Nacion");
    expect(message).toContain("https://stock-sur.test/public/service-document/token");

    expect(buildWhatsAppUrl({ phone: "", message })).toContain("https://wa.me/?text=");
    const mailto = buildMailtoUrl({ email: "qa@example.com", subject: "Presupuesto de servicio", body: message });
    expect(mailto).toContain("mailto:qa%40example.com?");
    expect(mailto).toContain("subject=Presupuesto%20de%20servicio");
    expect(mailto).toContain("body=Hola%2C%20te%20compartimos");
    expect(mailto).not.toContain("+");
  });

  it("sanitizes PDF file names", () => {
    expect(sanitizePdfFileName("Cliente / QA: Sur")).toBe("Cliente-QA-Sur");
  });
});
