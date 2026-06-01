export type AiFailureCode =
  | "AI_RATE_LIMITED"
  | "AI_TIMEOUT"
  | "AI_INVALID_RESPONSE"
  | "AI_PROVIDER_ERROR";

export type ControlledAiFailure = {
  code: AiFailureCode;
  status: 429 | 422 | 502 | 504;
  publicMessage: string;
  logMessage: string;
  retryAfterSeconds?: number;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "");
}

function extractRetryAfterSeconds(message: string) {
  const match = message.match(/retry\s+in\s+(\d+(?:\.\d+)?)s/i);
  if (!match) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.ceil(parsed) : undefined;
}

export function classifyAiFailure(error: unknown): ControlledAiFailure {
  const message = errorMessage(error);
  const normalized = message.toLowerCase();
  const retryAfterSeconds = extractRetryAfterSeconds(message);

  if (
    normalized.includes("quota") ||
    normalized.includes("rate limit") ||
    normalized.includes("rate-limit") ||
    normalized.includes("resource_exhausted") ||
    normalized.includes("too many requests")
  ) {
    return {
      code: "AI_RATE_LIMITED",
      status: 429,
      publicMessage: "El proveedor IA esta temporalmente limitado por cuota. Proba nuevamente en unos segundos o continua el presupuesto manualmente.",
      logMessage: message || "AI provider rate limited.",
      ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
    };
  }

  if (
    normalized.includes("abort") ||
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("deadline")
  ) {
    return {
      code: "AI_TIMEOUT",
      status: 504,
      publicMessage: "El proveedor IA tardo demasiado en responder. Proba nuevamente o continua el presupuesto manualmente.",
      logMessage: message || "AI provider timeout.",
    };
  }

  if (
    normalized.includes("json") ||
    normalized.includes("schema") ||
    normalized.includes("contenido") ||
    normalized.includes("lineas validas") ||
    normalized.includes("rango de precio invalido") ||
    normalized.includes("respuesta")
  ) {
    return {
      code: "AI_INVALID_RESPONSE",
      status: 422,
      publicMessage: "La IA no devolvio una propuesta valida. Proba con una descripcion mas concreta o continua el presupuesto manualmente.",
      logMessage: message || "AI provider returned invalid content.",
    };
  }

  return {
    code: "AI_PROVIDER_ERROR",
    status: 502,
    publicMessage: "No se pudo generar la propuesta IA en este momento. Podes continuar armando el presupuesto manualmente.",
    logMessage: message || "AI provider error.",
  };
}

export function shouldTryStructuredFallback(error: unknown) {
  const failure = classifyAiFailure(error);
  return failure.code !== "AI_RATE_LIMITED";
}
