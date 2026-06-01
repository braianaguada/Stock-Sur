import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildExternalReferenceContextFromGeminiPayload,
  buildGroundedReferencePrompt,
  buildStructuredPromptWithExternalContext,
  type ExternalReferenceContext,
  type JsonRecord,
} from "./grounding.ts";
import { classifyAiFailure, shouldTryStructuredFallback } from "./providerErrors.ts";

const AI_SERVICE_QUOTE_MODEL = "gemini-2.5-flash-lite";
const REQUEST_TIMEOUT_MS = 18_000;
const BNA_RATE_TIMEOUT_MS = 5_000;
const BNA_RATE_ENDPOINTS = [
  "https://www.bna.com.ar/Personas",
  "https://www.bna.com.ar/Cotizador/MonedasHistorico",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AiProviderResult = {
  output: ServiceQuoteAiSuggestion;
  model: string;
  externalReferenceContext: ExternalReferenceContext;
};

type ServiceQuoteAiSuggestion = {
  summary: string;
  recommendedPricingMode: "DETAILED" | "GLOBAL_TOTAL";
  recommendedCurrency: "ARS" | "USD";
  suggestedLines: Array<{
    description: string;
    quantity: number;
    unit: string;
    includeInQuote: boolean;
    notes: string;
  }>;
  possibleMaterials: Array<{
    name: string;
    reason: string;
    optional: boolean;
    needsConfirmation: boolean;
  }>;
  laborEstimate: {
    hoursMin: number;
    hoursRecommended: number;
    hoursMax: number;
    notes: string;
  };
  priceSuggestion: {
    currency: "ARS" | "USD";
    min: number;
    recommended: number;
    max: number;
    confidence: "LOW" | "MEDIUM" | "HIGH";
    explanation: string;
  };
  commercialNotes: string;
  internalNotes: string;
  warnings: string[];
  missingInfoQuestions: string[];
  pricingSources: PricingSources;
  confidenceReasons: string[];
};

type PricingSources = {
  internalHistoryUsed: boolean;
  internalHistoryCount: number;
  companySettingsUsed: boolean;
  externalReferencesUsed: boolean;
  externalReferenceSummary: string;
  limitations: string[];
};

type BnaRateSnapshot = {
  source: "BNA";
  rate: number;
  rateDate: string | null;
  fetchedAt: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function extractJsonPayload(rawText: string) {
  const trimmed = rawText.trim();
  if (!trimmed) throw new Error("Gemini no devolvio contenido.");

  try {
    return JSON.parse(trimmed) as JsonRecord;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("La respuesta de Gemini no fue JSON valido.");
    return JSON.parse(match[0]) as JsonRecord;
  }
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeCurrency(value: unknown): "ARS" | "USD" {
  return asString(value).toUpperCase() === "USD" ? "USD" : "ARS";
}

function normalizePricingMode(value: unknown): "DETAILED" | "GLOBAL_TOTAL" {
  return asString(value).toUpperCase() === "DETAILED" ? "DETAILED" : "GLOBAL_TOTAL";
}

function normalizeConfidence(value: unknown): "LOW" | "MEDIUM" | "HIGH" {
  const normalized = asString(value).toUpperCase();
  if (normalized === "LOW" || normalized === "HIGH") return normalized;
  return "MEDIUM";
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => asString(item)).filter(Boolean).slice(0, 12)
    : [];
}

function clampMoney(value: unknown) {
  const parsed = asNumber(value, 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(Math.round(parsed * 100) / 100, 999_999_999);
}

function normalizeRate(value: string) {
  const digits = value.replace(/[^\d.,]/g, "");
  const normalized = digits.includes(",")
    ? digits.replace(/\./g, "").replace(",", ".")
    : digits.replace(/\.(?=\d{3}(?:\.|$))/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseBnaHtmlUsdSellRate(html: string) {
  const dateMatch = html.match(/(?:Fecha:|fechaCot[^>]*>)\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  const rateDate = dateMatch
    ? `${dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`
    : null;
  const rowMatch = html.match(/<tr[^>]*>(?:(?!<\/tr>)[\s\S])*?D(?:o|\u00f3|&oacute;)lar\s+U\.?S\.?A(?:(?!<\/tr>)[\s\S])*?<\/tr>/i);
  if (!rowMatch) return null;

  const cells = Array.from(rowMatch[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi))
    .map((match) => match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  const rate = normalizeRate(cells[2] ?? "");
  return rate ? { rate, rateDate } : null;
}

function normalizePricingSources(value: unknown, context: {
  similarDocuments: unknown[];
  settings: JsonRecord | null;
  externalReferenceContext: ExternalReferenceContext;
  extraLimitations?: string[];
}): PricingSources {
  const record = (value ?? {}) as JsonRecord;
  const limitations = [
    ...stringArray(record.limitations),
    ...context.externalReferenceContext.limitations,
    ...(context.extraLimitations ?? []),
  ].filter((item, index, array) => array.indexOf(item) === index).slice(0, 12);

  return {
    internalHistoryUsed: asBoolean(record.internalHistoryUsed, context.similarDocuments.length > 0),
    internalHistoryCount: Math.max(0, Math.round(asNumber(record.internalHistoryCount, context.similarDocuments.length))),
    companySettingsUsed: asBoolean(record.companySettingsUsed, Boolean(context.settings)),
    externalReferencesUsed: context.externalReferenceContext.used,
    externalReferenceSummary: context.externalReferenceContext.used
      ? asString(
        record.externalReferenceSummary,
        context.externalReferenceContext.summary || "Se usaron referencias externas orientativas para validar insumos, complejidad y rango de precio.",
      )
      : "No se pudieron usar referencias externas en esta propuesta.",
    limitations,
  };
}

function validateSuggestion(payload: JsonRecord, context: {
  similarDocuments: unknown[];
  settings: JsonRecord | null;
  externalReferenceContext: ExternalReferenceContext;
  preferredCurrency: unknown;
  bnaRate: BnaRateSnapshot | null;
}): ServiceQuoteAiSuggestion {
  const suggestedLines = Array.isArray(payload.suggestedLines)
    ? payload.suggestedLines.map((line) => {
      const record = (line ?? {}) as JsonRecord;
      return {
        description: asString(record.description),
        quantity: Math.max(0.001, asNumber(record.quantity, 1)),
        unit: asString(record.unit, "serv"),
        includeInQuote: asBoolean(record.includeInQuote, true),
        notes: asString(record.notes),
      };
    }).filter((line) => line.description).slice(0, 12)
    : [];

  const possibleMaterials = Array.isArray(payload.possibleMaterials)
    ? payload.possibleMaterials.map((material) => {
      const record = (material ?? {}) as JsonRecord;
      return {
        name: asString(record.name),
        reason: asString(record.reason),
        optional: asBoolean(record.optional, true),
        needsConfirmation: asBoolean(record.needsConfirmation, true),
      };
    }).filter((material) => material.name).slice(0, 12)
    : [];

  const labor = (payload.laborEstimate ?? {}) as JsonRecord;
  const price = (payload.priceSuggestion ?? {}) as JsonRecord;
  const hoursMin = Math.max(0, asNumber(labor.hoursMin, 0));
  const hoursRecommended = Math.max(hoursMin, asNumber(labor.hoursRecommended, hoursMin));
  const hoursMax = Math.max(hoursRecommended, asNumber(labor.hoursMax, hoursRecommended));
  const recommendedCurrency = normalizeCurrency(context.preferredCurrency);
  const modelRecommendedCurrency = normalizeCurrency(payload.recommendedCurrency);
  const modelPriceCurrency = normalizeCurrency(price.currency ?? modelRecommendedCurrency);
  const conversionRate = context.bnaRate?.rate && context.bnaRate.rate > 0 ? context.bnaRate.rate : null;
  const conversionFactor = modelPriceCurrency === recommendedCurrency
    ? 1
    : conversionRate
      ? recommendedCurrency === "USD" ? 1 / conversionRate : conversionRate
      : 1;
  const currencyLimitations = modelPriceCurrency !== recommendedCurrency && !conversionRate
    ? ["La IA devolvio otra moneda y se forzo la moneda seleccionada sin cotizacion de conversion disponible."]
    : [];
  const min = clampMoney(clampMoney(price.min) * conversionFactor);
  const recommended = clampMoney(clampMoney(price.recommended) * conversionFactor);
  const max = clampMoney(clampMoney(price.max) * conversionFactor);

  if (!asString(payload.summary)) throw new Error("La propuesta IA no incluye resumen.");
  if (suggestedLines.length === 0) throw new Error("La propuesta IA no incluye lineas validas.");
  if (!min || !recommended || !max || min > recommended || recommended > max) {
    throw new Error("La propuesta IA devolvio un rango de precio invalido.");
  }

  return {
    summary: asString(payload.summary),
    recommendedPricingMode: normalizePricingMode(payload.recommendedPricingMode),
    recommendedCurrency,
    suggestedLines,
    possibleMaterials,
    laborEstimate: {
      hoursMin,
      hoursRecommended,
      hoursMax,
      notes: asString(labor.notes),
    },
    priceSuggestion: {
      currency: recommendedCurrency,
      min,
      recommended,
      max,
      confidence: normalizeConfidence(price.confidence),
      explanation: asString(price.explanation, "Estimacion orientativa sujeta a revision humana."),
    },
    commercialNotes: asString(payload.commercialNotes),
    internalNotes: asString(payload.internalNotes),
    warnings: stringArray(payload.warnings),
    missingInfoQuestions: stringArray(payload.missingInfoQuestions),
    pricingSources: normalizePricingSources(payload.pricingSources, { ...context, extraLimitations: currencyLimitations }),
    confidenceReasons: [
      ...stringArray(payload.confidenceReasons),
      ...(modelPriceCurrency !== recommendedCurrency && conversionRate
        ? [`La IA devolvio ${modelPriceCurrency}; se convirtio a ${recommendedCurrency} usando BNA como referencia.`]
        : currencyLimitations),
    ].filter((item, index, array) => array.indexOf(item) === index).slice(0, 12),
  };
}

function responseSchema() {
  return {
    type: "OBJECT",
    properties: {
      summary: { type: "STRING" },
      recommendedPricingMode: { type: "STRING", enum: ["DETAILED", "GLOBAL_TOTAL"] },
      recommendedCurrency: { type: "STRING", enum: ["ARS", "USD"] },
      suggestedLines: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            description: { type: "STRING" },
            quantity: { type: "NUMBER" },
            unit: { type: "STRING" },
            includeInQuote: { type: "BOOLEAN" },
            notes: { type: "STRING" },
          },
          required: ["description", "quantity", "unit", "includeInQuote", "notes"],
        },
      },
      possibleMaterials: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            reason: { type: "STRING" },
            optional: { type: "BOOLEAN" },
            needsConfirmation: { type: "BOOLEAN" },
          },
          required: ["name", "reason", "optional", "needsConfirmation"],
        },
      },
      laborEstimate: {
        type: "OBJECT",
        properties: {
          hoursMin: { type: "NUMBER" },
          hoursRecommended: { type: "NUMBER" },
          hoursMax: { type: "NUMBER" },
          notes: { type: "STRING" },
        },
        required: ["hoursMin", "hoursRecommended", "hoursMax", "notes"],
      },
      priceSuggestion: {
        type: "OBJECT",
        properties: {
          currency: { type: "STRING", enum: ["ARS", "USD"] },
          min: { type: "NUMBER" },
          recommended: { type: "NUMBER" },
          max: { type: "NUMBER" },
          confidence: { type: "STRING", enum: ["LOW", "MEDIUM", "HIGH"] },
          explanation: { type: "STRING" },
        },
        required: ["currency", "min", "recommended", "max", "confidence", "explanation"],
      },
      commercialNotes: { type: "STRING" },
      internalNotes: { type: "STRING" },
      warnings: { type: "ARRAY", items: { type: "STRING" } },
      missingInfoQuestions: { type: "ARRAY", items: { type: "STRING" } },
      pricingSources: {
        type: "OBJECT",
        properties: {
          internalHistoryUsed: { type: "BOOLEAN" },
          internalHistoryCount: { type: "NUMBER" },
          companySettingsUsed: { type: "BOOLEAN" },
          externalReferencesUsed: { type: "BOOLEAN" },
          externalReferenceSummary: { type: "STRING" },
          limitations: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: [
          "internalHistoryUsed",
          "internalHistoryCount",
          "companySettingsUsed",
          "externalReferencesUsed",
          "externalReferenceSummary",
          "limitations",
        ],
      },
      confidenceReasons: { type: "ARRAY", items: { type: "STRING" } },
    },
    required: [
      "summary",
      "recommendedPricingMode",
      "recommendedCurrency",
      "suggestedLines",
      "possibleMaterials",
      "laborEstimate",
      "priceSuggestion",
      "commercialNotes",
      "internalNotes",
      "warnings",
      "missingInfoQuestions",
      "pricingSources",
      "confidenceReasons",
    ],
  };
}

function buildPrompt(params: {
  input: JsonRecord;
  settings: JsonRecord | null;
  similarDocuments: unknown[];
  bnaRate: BnaRateSnapshot | null;
}) {
  const preferredCurrency = normalizeCurrency(params.input.preferredCurrency);
  return [
    "Sos un asistente para presupuestar servicios tecnicos y comerciales en Stock Sur.",
    "Devolve solo JSON valido segun el schema solicitado.",
    "La salida sera revisada por un humano y luego aplicada a un Presupuesto de Servicio editable.",
    "No generes remitos, facturas, caja, stock ni cuenta corriente.",
    "No prometas exactitud. Indica supuestos, advertencias y preguntas faltantes.",
    "Sugerí rango de precio minimo, recomendado y alto; nunca un precio unico.",
    "Si no hay desglose confiable por item, preferi recommendedPricingMode GLOBAL_TOTAL.",
    "Si faltan datos que cambian el precio, incluilos en missingInfoQuestions y baja la confianza.",
    "Si el provider aporta referencias externas, usalas solo como orientacion para validar insumos, complejidad y rango sugerido.",
    "No copies precios externos como verdad absoluta y no reemplaces el historico interno ni la validacion humana.",
    "Explica en pricingSources y confidenceReasons cuanto pesa el historico interno, si hay pocos datos, si se usaron referencias externas, que falta confirmar y que variables pueden cambiar el precio.",
    "Usa lenguaje prudente: referencias orientativas, estimacion, rango sugerido y requiere validacion humana.",
    "Si hay cotizacion BNA disponible, usala solo como referencia de conversion ARS/USD y no inventes otra cotizacion.",
    "Usa ARS o USD solamente. No inventes cotizacion USD.",
    `La moneda elegida por el usuario es ${preferredCurrency}. Es obligatoria para recommendedCurrency y priceSuggestion.currency.`,
    preferredCurrency === "USD"
      ? "Si hay cotizacion BNA, usala solo como referencia o equivalencia. No cambies la salida final a ARS."
      : "No cambies la salida final a USD salvo que la moneda elegida por el usuario sea USD.",
    "",
    "Contexto del pedido:",
    JSON.stringify(params.input),
    "",
    "Configuracion de empresa disponible:",
    JSON.stringify(params.settings ?? {}),
    "",
    "Presupuestos historicos similares de la misma empresa:",
    JSON.stringify(params.similarDocuments),
    "",
    "Cotizacion BNA disponible si corresponde:",
    JSON.stringify(params.bnaRate ?? {}),
  ].join("\n");
}

async function getBnaUsdRateIfNeeded(preferredCurrency: unknown): Promise<BnaRateSnapshot | null> {
  if (normalizeCurrency(preferredCurrency) !== "USD") return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BNA_RATE_TIMEOUT_MS);
  try {
    for (const endpoint of BNA_RATE_ENDPOINTS) {
      const response = await fetch(endpoint, {
        signal: controller.signal,
        headers: { Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
      });
      if (!response.ok) continue;

      const parsed = parseBnaHtmlUsdSellRate(await response.text());
      if (parsed) {
        return {
          source: "BNA",
          rate: parsed.rate,
          rateDate: parsed.rateDate,
          fetchedAt: new Date().toISOString(),
        };
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function callGeminiProvider(params: {
  apiKey: string;
  model: string;
  prompt: string;
  settings: JsonRecord | null;
  similarDocuments: unknown[];
  useGrounding: boolean;
  preferredCurrency: unknown;
  bnaRate: BnaRateSnapshot | null;
}): Promise<AiProviderResult> {
  const call = async (request: { useGrounding: boolean; prompt: string; structuredOutput: boolean }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${params.apiKey}`,
        {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: request.prompt }] }],
            tools: request.useGrounding ? [{ google_search: {} }] : undefined,
            generationConfig: request.structuredOutput
              ? {
                temperature: 0.25,
                responseMimeType: "application/json",
                responseSchema: responseSchema(),
              }
              : { temperature: 0.2 },
          }),
        },
      );
    } finally {
      clearTimeout(timeout);
    }

    const geminiPayload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof geminiPayload?.error?.message === "string"
        ? geminiPayload.error.message
        : "Gemini devolvio un error.";
      throw new Error(message);
    }

    const rawText =
      geminiPayload?.candidates?.[0]?.content?.parts?.find((part: { text?: string }) => typeof part.text === "string")
        ?.text ?? "";
    return { rawText, geminiPayload: geminiPayload as JsonRecord };
  };

  const buildResult = (rawText: string, externalReferenceContext: ExternalReferenceContext) => ({
    output: validateSuggestion(extractJsonPayload(rawText), {
      similarDocuments: params.similarDocuments,
      settings: params.settings,
      externalReferenceContext,
      preferredCurrency: params.preferredCurrency,
      bnaRate: params.bnaRate,
    }),
    model: params.model,
    externalReferenceContext,
  });

  const buildFallbackContext = (error: unknown) => buildExternalReferenceContextFromGeminiPayload({
    geminiPayload: {},
    attempted: true,
    failed: true,
    failureReason: error instanceof Error ? error.message : "Fallo la consulta externa.",
  });

  if (!params.useGrounding) {
    const { rawText } = await call({ useGrounding: false, prompt: params.prompt, structuredOutput: true });
    return buildResult(rawText, buildExternalReferenceContextFromGeminiPayload({
      geminiPayload: {},
      attempted: false,
      failed: false,
    }));
  }

  let externalReferenceContext: ExternalReferenceContext;
  try {
    const { rawText, geminiPayload } = await call({
      useGrounding: true,
      prompt: buildGroundedReferencePrompt(params.prompt),
      structuredOutput: false,
    });
    externalReferenceContext = buildExternalReferenceContextFromGeminiPayload({
      geminiPayload,
      attempted: true,
      failed: false,
      rawText,
    });
  } catch (error) {
    if (!shouldTryStructuredFallback(error)) throw error;
    externalReferenceContext = buildFallbackContext(error);
  }

  try {
    const { rawText } = await call({
      useGrounding: false,
      prompt: buildStructuredPromptWithExternalContext(params.prompt, externalReferenceContext),
      structuredOutput: true,
    });
    return buildResult(rawText, externalReferenceContext);
  } catch (error) {
    if (!shouldTryStructuredFallback(error)) throw error;
    const fallbackContext = buildFallbackContext(error);
    const { rawText } = await call({
      useGrounding: false,
      prompt: buildStructuredPromptWithExternalContext(params.prompt, fallbackContext),
      structuredOutput: true,
    });
    return buildResult(rawText, fallbackContext);
  }
}

async function getSimilarDocuments(actorClient: ReturnType<typeof createClient>, companyId: string, description: string) {
  const words = description
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 5)
    .slice(0, 5);

  if (words.length === 0) return [];

  const { data } = await actorClient
    .from("service_documents")
    .select("id, reference, total, currency, pricing_mode, issue_date, service_document_lines(description)")
    .eq("company_id", companyId)
    .eq("type", "QUOTE")
    .order("created_at", { ascending: false })
    .limit(80);

  const rows = Array.isArray(data) ? data : [];
  return rows
    .map((document: JsonRecord) => {
      const lines = Array.isArray(document.service_document_lines) ? document.service_document_lines : [];
      const text = [document.reference, ...lines.map((line) => (line as JsonRecord).description)]
        .join(" ")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      const score = words.reduce((sum, word) => sum + (text.includes(word) ? 1 : 0), 0);
      return { document, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
    .map(({ document }) => ({
      reference: document.reference,
      total: document.total,
      currency: document.currency,
      pricingMode: document.pricing_mode,
      issueDate: document.issue_date,
    }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    const model = Deno.env.get("AI_SERVICE_QUOTE_MODEL") ?? Deno.env.get("GEMINI_MODEL") ?? AI_SERVICE_QUOTE_MODEL;
    const provider = Deno.env.get("AI_PROVIDER") ?? "gemini";
    const useGrounding = Deno.env.get("AI_SERVICE_QUOTE_USE_GROUNDING") !== "false";

    if (!supabaseUrl || !supabaseAnonKey) return json({ error: "Faltan secretos base de Supabase." }, 500);
    if (provider !== "gemini") return json({ error: "Proveedor IA no soportado para presupuestos de servicio." }, 500);
    if (!geminiApiKey) return json({ error: "El asistente IA no esta configurado todavia." }, 503);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Falta el header Authorization." }, 401);

    const actorClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await actorClient.auth.getUser();
    if (authError || !user) return json({ error: "No se pudo validar la sesion actual." }, 401);

    const body = await req.json().catch(() => ({})) as JsonRecord;
    const companyId = asString(body.companyId);
    const description = asString(body.description);
    if (!companyId) return json({ error: "Selecciona una empresa antes de usar el asistente IA." }, 400);
    if (description.length < 10) return json({ error: "Describi el servicio con un poco mas de detalle." }, 400);

    const { data: settings } = await actorClient
      .from("service_quote_ai_settings")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();
    const similarDocuments = await getSimilarDocuments(actorClient, companyId, description);

    const inputSnapshot = {
      companyId,
      description,
      customerId: body.customerId ?? null,
      customerName: body.customerName ?? null,
      equipmentType: body.equipmentType ?? null,
      businessArea: body.businessArea ?? null,
      location: body.location ?? null,
      urgency: body.urgency ?? "NORMAL",
      complexity: body.complexity ?? "MEDIUM",
      preferredCurrency: normalizeCurrency(body.preferredCurrency ?? settings?.default_currency ?? "ARS"),
      knownMaterials: body.knownMaterials ?? null,
      includesLabor: body.includesLabor ?? true,
      includesTravel: body.includesTravel ?? false,
      priceStyle: body.priceStyle ?? "NORMAL",
      currentLines: Array.isArray(body.currentLines) ? body.currentLines.slice(0, 12) : [],
      currentNotes: body.currentNotes ?? null,
    };
    const bnaRate = await getBnaUsdRateIfNeeded(inputSnapshot.preferredCurrency);

    const prompt = buildPrompt({ input: inputSnapshot, settings: settings as JsonRecord | null, similarDocuments, bnaRate });
    const result = await callGeminiProvider({
      apiKey: geminiApiKey,
      model,
      prompt,
      settings: settings as JsonRecord | null,
      similarDocuments,
      useGrounding,
      preferredCurrency: inputSnapshot.preferredCurrency,
      bnaRate,
    });

    const { data: suggestionRow, error: insertError } = await actorClient
      .from("service_document_ai_suggestions")
      .insert({
        company_id: companyId,
        input_snapshot: { ...inputSnapshot, similarDocuments, bnaRate },
        output_snapshot: {
          ...result.output,
          externalReferenceContext: result.externalReferenceContext,
          traceability: {
            pricingSources: result.output.pricingSources,
            confidenceReasons: result.output.confidenceReasons,
            externalReferencesUsed: result.externalReferenceContext.used,
            externalReferenceSummary: result.output.pricingSources.externalReferenceSummary,
            externalReferences: {
              provider: result.externalReferenceContext.provider,
              webSearchQueries: result.externalReferenceContext.webSearchQueries,
              sources: result.externalReferenceContext.sources,
              summary: result.externalReferenceContext.summary,
              fetchedAt: result.externalReferenceContext.fetchedAt,
            },
            limitations: result.output.pricingSources.limitations,
            bnaRateUsed: Boolean(bnaRate),
            bnaRate,
            timestamp: result.externalReferenceContext.fetchedAt,
          },
        },
        suggested_min_total: result.output.priceSuggestion.min,
        suggested_recommended_total: result.output.priceSuggestion.recommended,
        suggested_max_total: result.output.priceSuggestion.max,
        confidence: result.output.priceSuggestion.confidence,
        accepted: false,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    return json({
      suggestionId: suggestionRow?.id ?? null,
      model: result.model,
      suggestion: result.output,
    });
  } catch (error) {
    const failure = classifyAiFailure(error);
    console.error("service_quote_ai_assistant_failed", {
      code: failure.code,
      status: failure.status,
      message: failure.logMessage,
    });
    return json({
      error: failure.publicMessage,
      code: failure.code,
      retryAfterSeconds: failure.retryAfterSeconds ?? null,
    }, failure.status);
  }
});
