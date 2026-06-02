export type JsonRecord = Record<string, unknown>;

export type ExternalReferenceSource = {
  title: string;
  uri: string;
};

export type ExternalReferenceContext = {
  attempted: boolean;
  used: boolean;
  failed: boolean;
  summary: string;
  limitations: string[];
  webSearchQueries: string[];
  sources: ExternalReferenceSource[];
  provider: "gemini_google_search";
  fetchedAt: string;
  failureReason?: string;
};

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => sanitizeText(asString(item))).filter(Boolean).slice(0, 12)
    : [];
}

function sanitizeText(value: string, maxLength = 600) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function sanitizeUri(value: string) {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return "";
  return trimmed.slice(0, 500);
}

function extractGroundedSummary(rawText: string) {
  const text = rawText.trim();
  if (!text) return { summary: "", limitations: [] };
  const jsonCandidate = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim() ?? text.match(/\{[\s\S]*\}/)?.[0] ?? text;

  try {
    const record = JSON.parse(jsonCandidate) as JsonRecord;
    return {
      summary: sanitizeText(asString(record.summary), 600),
      limitations: stringArray(record.limitations),
    };
  } catch {
    const summaryMatch = text.match(/resumen\s*:?\s*([\s\S]*?)(?:limitaciones\s*:|$)/i);
    const limitationsMatch = text.match(/limitaciones\s*:?\s*([\s\S]*)/i);
    return {
      summary: sanitizeText(summaryMatch?.[1] ?? text, 600),
      limitations: limitationsMatch ? [sanitizeText(limitationsMatch[1], 240)].filter(Boolean) : [],
    };
  }
}

export function buildExternalReferenceContextFromGeminiPayload(params: {
  geminiPayload: JsonRecord;
  attempted: boolean;
  failed: boolean;
  rawText?: string;
  failureReason?: string;
  now?: Date;
}): ExternalReferenceContext {
  const candidates = Array.isArray(params.geminiPayload.candidates) ? params.geminiPayload.candidates : [];
  const firstCandidate = (candidates[0] ?? {}) as JsonRecord;
  const metadata = (firstCandidate.groundingMetadata ?? {}) as JsonRecord;
  const queries = stringArray(metadata.webSearchQueries).slice(0, 5);
  const chunks = Array.isArray(metadata.groundingChunks) ? metadata.groundingChunks : [];
  const sources = chunks.map((chunk) => {
    const web = (((chunk as JsonRecord).web ?? {}) as JsonRecord);
    return {
      title: sanitizeText(asString(web.title), 160),
      uri: sanitizeUri(asString(web.uri)),
    };
  }).filter((source) => source.title || source.uri).slice(0, 5);
  const groundedSummary = extractGroundedSummary(params.rawText ?? "");
  const used = params.attempted && !params.failed && (queries.length > 0 || sources.length > 0);
  const failureReason = sanitizeText(params.failureReason ?? "", 240);

  return {
    attempted: params.attempted,
    used,
    failed: params.failed,
    summary: used
      ? groundedSummary.summary || "Se usaron referencias externas orientativas para validar insumos, complejidad y rango de precio."
      : "",
    limitations: [
      ...groundedSummary.limitations,
      ...(params.failed ? ["No se pudieron usar referencias externas en esta propuesta."] : []),
    ].filter((item, index, array) => item && array.indexOf(item) === index).slice(0, 12),
    webSearchQueries: queries,
    sources,
    provider: "gemini_google_search",
    fetchedAt: (params.now ?? new Date()).toISOString(),
    ...(failureReason ? { failureReason } : {}),
  };
}

export function buildGroundedReferencePrompt(prompt: string) {
  return [
    prompt,
    "",
    "Para esta llamada debes ejecutar Google Search y usar referencias externas reales.",
    "Busca referencias argentinas recientes sobre costo orientativo, repuestos, insumos o complejidad del servicio.",
    "Si no encontrás precio confiable, igual devolve las consultas y fuentes usadas para validar alcance y limitaciones.",
    "Devolve un JSON breve, sin HTML ni contenido copiado de paginas:",
    JSON.stringify({
      summary: "Resumen prudente de referencias orientativas usadas.",
      limitations: ["Limitacion o dato que falta confirmar."],
    }),
  ].join("\n");
}

export function buildStructuredPromptWithExternalContext(prompt: string, context: ExternalReferenceContext) {
  return [
    prompt,
    "",
    "Referencias externas ya consultadas para esta propuesta:",
    JSON.stringify({
      externalReferencesUsed: context.used,
      summary: context.summary,
      webSearchQueries: context.webSearchQueries,
      sources: context.sources,
      limitations: context.limitations,
      fetchedAt: context.fetchedAt,
    }),
    "",
    "Usa esas referencias solo como orientacion. No copies contenido web ni guardes HTML.",
    "pricingSources.externalReferencesUsed debe coincidir con externalReferencesUsed.",
  ].join("\n");
}
