export type GroundingMode = "auto" | "always" | "never";
export type GroundingDecisionValue = "used" | "skipped";

export type GroundingDecision = {
  mode: GroundingMode;
  decision: GroundingDecisionValue;
  reason: string;
};

export function plannedAiCallCount(decision: GroundingDecision) {
  return decision.decision === "used" ? 2 : 1;
}

export function groundingSnapshotFields(decision: GroundingDecision, aiCallCount: number) {
  return {
    groundingMode: decision.mode,
    groundingDecision: decision.decision,
    groundingReason: decision.reason,
    aiCallCount,
  };
}

const COMPLEX_SERVICE_PATTERN =
  /\b(motocompresor|compresor|motor|plaqueta|repuesto|repuestos|gas refrigerante|instalacion|reparacion compleja|camara frigorifica|heladera comercial)\b/i;

const MATERIAL_PRICE_PATTERN =
  /\b(cambio|reemplazo|material|materiales|repuesto|repuestos|cotizar|precio|costo|gas|carga de gas|fuga)\b/i;

const SIMPLE_SERVICE_PATTERN =
  /\b(limpieza de (aire acondicionado )?split|limpieza de split|revision basica|prueba de funcionamiento|mantenimiento simple|revision y prueba)\b/i;

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeGroundingMode(value: unknown): GroundingMode {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "always" || normalized === "never") return normalized;
  return "auto";
}

export function decideGrounding(params: {
  mode: GroundingMode;
  description: string;
  similarDocumentsCount: number;
  complexity?: unknown;
  knownMaterials?: unknown;
}): GroundingDecision {
  const mode = params.mode;
  if (mode === "always") {
    return {
      mode,
      decision: "used",
      reason: "Modo always configurado para intentar referencias externas siempre",
    };
  }
  if (mode === "never") {
    return {
      mode,
      decision: "skipped",
      reason: "Modo never configurado para evitar referencias externas",
    };
  }

  const text = normalizeText(params.description);
  const similarCount = Math.max(0, Math.round(params.similarDocumentsCount));
  const hasComplexTerms = COMPLEX_SERVICE_PATTERN.test(text);
  const hasMaterialPriceIntent = MATERIAL_PRICE_PATTERN.test(text) || Boolean(params.knownMaterials);
  const looksSimple = SIMPLE_SERVICE_PATTERN.test(text) && !hasComplexTerms && !hasMaterialPriceIntent;
  const complexity = typeof params.complexity === "string" ? params.complexity.toUpperCase() : "";
  const lowInternalConfidence = similarCount < 3 || complexity === "HIGH";

  if (looksSimple) {
    return {
      mode,
      decision: "skipped",
      reason: "Servicio simple con bajo requerimiento de referencias externas",
    };
  }

  if (similarCount >= 3 && !hasComplexTerms && !hasMaterialPriceIntent && complexity !== "HIGH") {
    return {
      mode,
      decision: "skipped",
      reason: "Historico interno suficiente y sin repuestos o materiales complejos",
    };
  }

  if (hasComplexTerms || hasMaterialPriceIntent || lowInternalConfidence) {
    return {
      mode,
      decision: "used",
      reason: hasComplexTerms || hasMaterialPriceIntent
        ? "Servicio complejo con repuestos o materiales y baja referencia interna"
        : "Confianza interna baja o media por pocos historicos similares",
    };
  }

  return {
    mode,
    decision: "skipped",
    reason: "No se detecto necesidad clara de referencias externas",
  };
}
