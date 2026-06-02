import { z } from "zod";
import type { ServiceDocumentCurrency, ServiceDocumentForm, ServiceDocumentLine, ServiceDocumentPricingMode } from "./types";

export const AI_SERVICE_QUOTE_MODEL = "gemini-2.5-flash-lite";

export const serviceQuoteAiSchema = z.object({
  summary: z.string().trim().min(1),
  recommendedPricingMode: z.enum(["DETAILED", "GLOBAL_TOTAL"]),
  recommendedCurrency: z.enum(["ARS", "USD"]),
  suggestedLines: z.array(z.object({
    description: z.string().trim().min(1),
    quantity: z.number().positive().default(1),
    unit: z.string().trim().min(1).default("serv"),
    includeInQuote: z.boolean().default(true),
    notes: z.string().trim().optional().default(""),
  })).min(1),
  possibleMaterials: z.array(z.object({
    name: z.string().trim().min(1),
    reason: z.string().trim().optional().default(""),
    optional: z.boolean().default(true),
    needsConfirmation: z.boolean().default(true),
  })).default([]),
  laborEstimate: z.object({
    hoursMin: z.number().nonnegative(),
    hoursRecommended: z.number().nonnegative(),
    hoursMax: z.number().nonnegative(),
    notes: z.string().trim().optional().default(""),
  }).refine((value) => value.hoursMin <= value.hoursRecommended && value.hoursRecommended <= value.hoursMax, {
    message: "La estimacion de horas debe cumplir min <= recomendado <= max",
  }),
  priceSuggestion: z.object({
    currency: z.enum(["ARS", "USD"]),
    min: z.number().positive(),
    recommended: z.number().positive(),
    max: z.number().positive(),
    confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
    explanation: z.string().trim().min(1),
  }).refine((value) => value.min <= value.recommended && value.recommended <= value.max, {
    message: "El rango de precio debe cumplir min <= recomendado <= max",
  }),
  commercialNotes: z.string().trim().optional().default(""),
  internalNotes: z.string().trim().optional().default(""),
  warnings: z.array(z.string().trim().min(1)).default([]),
  missingInfoQuestions: z.array(z.string().trim().min(1)).default([]),
  pricingSources: z.object({
    internalHistoryUsed: z.boolean(),
    internalHistoryCount: z.number().int().nonnegative(),
    companySettingsUsed: z.boolean(),
    externalReferencesUsed: z.boolean(),
    externalReferenceSummary: z.string().trim().default(""),
    limitations: z.array(z.string().trim().min(1)).default([]),
  }),
  confidenceReasons: z.array(z.string().trim().min(1)).default([]),
}).refine((value) => value.recommendedCurrency === value.priceSuggestion.currency, {
  message: "La moneda recomendada debe coincidir con la moneda del precio sugerido",
});

export type ServiceQuoteAiSuggestion = z.infer<typeof serviceQuoteAiSchema>;

export type ServiceQuoteAiApplyMode = "all" | "lines" | "price";

export type ServiceQuoteAiRequest = {
  companyId: string;
  description: string;
  customerId?: string | null;
  customerName?: string | null;
  equipmentType?: string;
  businessArea?: string;
  location?: string;
  urgency?: "LOW" | "NORMAL" | "HIGH";
  complexity?: "LOW" | "MEDIUM" | "HIGH";
  preferredCurrency?: ServiceDocumentCurrency;
  knownMaterials?: string;
  includesLabor?: boolean;
  includesTravel?: boolean;
  priceStyle?: "ECONOMY" | "NORMAL" | "PREMIUM";
  currentLines?: ServiceDocumentLine[];
  currentNotes?: string;
};

export type ServiceQuoteAiResponse = {
  suggestionId?: string | null;
  model?: string | null;
  suggestion: ServiceQuoteAiSuggestion;
};

function buildLineDescription(line: ServiceQuoteAiSuggestion["suggestedLines"][number]) {
  return [line.description, line.notes ? `Nota: ${line.notes}` : ""].filter(Boolean).join("\n");
}

export function buildServiceLinesFromAiSuggestion(suggestion: ServiceQuoteAiSuggestion): ServiceDocumentLine[] {
  return suggestion.suggestedLines
    .filter((line) => line.includeInQuote)
    .map((line, index) => ({
      description: buildLineDescription(line),
      quantity: line.quantity,
      unit: line.unit,
      unit_price: suggestion.recommendedPricingMode === "GLOBAL_TOTAL" ? null : 0,
      line_total: 0,
      sort_order: index + 1,
    }));
}

export function applyAiSuggestionToServiceDraft(params: {
  form: ServiceDocumentForm;
  lines: ServiceDocumentLine[];
  suggestion: ServiceQuoteAiSuggestion;
  mode: ServiceQuoteAiApplyMode;
  appendLines?: boolean;
}) {
  const { form, lines, suggestion, mode, appendLines = true } = params;
  const nextForm: ServiceDocumentForm = { ...form, status: "DRAFT" };
  let nextLines = lines;

  if (mode === "all" || mode === "lines") {
    const aiLines = buildServiceLinesFromAiSuggestion(suggestion);
    const existingLines = lines.filter((line) => line.description.trim());
    nextLines = appendLines && existingLines.length > 0
      ? [...existingLines, ...aiLines.map((line, index) => ({ ...line, sort_order: existingLines.length + index + 1 }))]
      : aiLines;
    if (nextLines.length === 0) nextLines = buildServiceLinesFromAiSuggestion(suggestion);
  }

  if (mode === "all" || mode === "price") {
    nextForm.currency = suggestion.recommendedCurrency;
    nextForm.pricing_mode = suggestion.recommendedPricingMode;
    nextForm.hide_line_prices = suggestion.recommendedPricingMode === "GLOBAL_TOTAL";
    nextForm.global_total = suggestion.recommendedPricingMode === "GLOBAL_TOTAL"
      ? String(suggestion.priceSuggestion.recommended)
      : "";
  }

  if (mode === "all") {
    nextForm.intro_text = suggestion.summary;
    nextForm.closing_text = suggestion.commercialNotes || form.closing_text;
  }

  return { form: nextForm, lines: nextLines };
}
