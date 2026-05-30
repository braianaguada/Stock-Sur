import { describe, expect, it } from "vitest";
import { applyAiSuggestionToServiceDraft, buildServiceLinesFromAiSuggestion, serviceQuoteAiSchema } from "./aiAssistant";
import type { ServiceDocumentForm, ServiceDocumentLine } from "./types";

const validSuggestion = {
  summary: "Cambio de motocompresor con prueba final",
  recommendedPricingMode: "GLOBAL_TOTAL",
  recommendedCurrency: "ARS",
  suggestedLines: [
    { description: "Diagnostico tecnico", quantity: 1, unit: "servicio", includeInQuote: true, notes: "Verificar falla" },
  ],
  possibleMaterials: [
    { name: "Motocompresor", reason: "Puede requerir reemplazo", optional: false, needsConfirmation: true },
  ],
  laborEstimate: { hoursMin: 2, hoursRecommended: 4, hoursMax: 6, notes: "Depende del acceso" },
  priceSuggestion: {
    currency: "ARS",
    min: 720000,
    recommended: 850000,
    max: 980000,
    confidence: "MEDIUM",
    explanation: "Incluye mano de obra, traslado y materiales posibles",
  },
  commercialNotes: "Sujeto a verificacion del equipo.",
  internalNotes: "Confirmar modelo.",
  warnings: ["Confirmar fuga."],
  missingInfoQuestions: ["Cual es el modelo?"],
} as const;

const baseForm: ServiceDocumentForm = {
  customer_id: "cust-1",
  status: "DRAFT",
  reference: "",
  issue_date: "2026-05-30",
  valid_until: "",
  intro_text: "",
  delivery_time: "",
  payment_terms: "",
  delivery_location: "",
  closing_text: "",
  currency: "ARS",
  exchange_rate_source: "BNA",
  exchange_rate: "",
  exchange_rate_date: "",
  exchange_rate_fetched_at: "",
  exchange_rate_snapshot_label: "",
  show_exchange_rate_note: true,
  pricing_mode: "DETAILED",
  global_total: "",
  hide_line_prices: false,
};

describe("serviceQuoteAiSchema", () => {
  it("accepts a valid structured AI suggestion", () => {
    expect(serviceQuoteAiSchema.parse(validSuggestion).priceSuggestion.recommended).toBe(850000);
  });

  it("rejects invalid price ranges", () => {
    expect(() => serviceQuoteAiSchema.parse({
      ...validSuggestion,
      priceSuggestion: { ...validSuggestion.priceSuggestion, min: 900000, recommended: 850000 },
    })).toThrow();
  });

  it("rejects unsupported currency and pricing modes", () => {
    expect(() => serviceQuoteAiSchema.parse({ ...validSuggestion, recommendedCurrency: "EUR" })).toThrow();
    expect(() => serviceQuoteAiSchema.parse({ ...validSuggestion, recommendedPricingMode: "FREE_TEXT" })).toThrow();
  });

  it("rejects empty quote lines", () => {
    expect(() => serviceQuoteAiSchema.parse({ ...validSuggestion, suggestedLines: [] })).toThrow();
  });
});

describe("AI suggestion application", () => {
  it("builds descriptive lines without line prices for GLOBAL_TOTAL", () => {
    const lines = buildServiceLinesFromAiSuggestion(serviceQuoteAiSchema.parse(validSuggestion));

    expect(lines).toEqual([
      expect.objectContaining({
        description: expect.stringContaining("Diagnostico tecnico"),
        unit_price: null,
        line_total: 0,
      }),
    ]);
  });

  it("applies all data as an editable DRAFT global total budget", () => {
    const result = applyAiSuggestionToServiceDraft({
      form: baseForm,
      lines: [{ description: "", quantity: 1, unit: "serv", unit_price: 0, line_total: 0, sort_order: 1 }],
      suggestion: serviceQuoteAiSchema.parse(validSuggestion),
      mode: "all",
    });

    expect(result.form.status).toBe("DRAFT");
    expect(result.form.pricing_mode).toBe("GLOBAL_TOTAL");
    expect(result.form.global_total).toBe("850000");
    expect(result.form.hide_line_prices).toBe(true);
    expect(result.lines[0].unit_price).toBeNull();
  });

  it("can apply only lines without touching the current price", () => {
    const existingLine: ServiceDocumentLine = {
      description: "Trabajo existente",
      quantity: 1,
      unit: "serv",
      unit_price: 100,
      line_total: 100,
      sort_order: 1,
    };
    const result = applyAiSuggestionToServiceDraft({
      form: { ...baseForm, pricing_mode: "DETAILED", global_total: "" },
      lines: [existingLine],
      suggestion: serviceQuoteAiSchema.parse(validSuggestion),
      mode: "lines",
      appendLines: true,
    });

    expect(result.form.pricing_mode).toBe("DETAILED");
    expect(result.form.global_total).toBe("");
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].description).toBe("Trabajo existente");
  });

  it("can apply only price without replacing lines", () => {
    const result = applyAiSuggestionToServiceDraft({
      form: baseForm,
      lines: [{ description: "Mantener", quantity: 1, unit: "serv", unit_price: 10, line_total: 10, sort_order: 1 }],
      suggestion: serviceQuoteAiSchema.parse(validSuggestion),
      mode: "price",
    });

    expect(result.form.global_total).toBe("850000");
    expect(result.lines[0].description).toBe("Mantener");
  });
});
