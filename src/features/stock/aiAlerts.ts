import type { StockInsight } from "@/features/stock/insights";

type StockAiResponse = {
  summary?: string;
  meta?: {
    model?: string;
  };
};

export interface StockAiSummaryResult {
  summary: string | null;
  model: string | null;
}

async function getSupabaseClient() {
  const module = await import("@/integrations/supabase/client");
  return module.supabase;
}

function buildCandidates(alerts: StockInsight[]) {
  return alerts.slice(0, 12).map((alert) => ({
    itemName: alert.itemName,
    tone: alert.tone,
    kind: alert.kind,
    priority: alert.priority,
    title: alert.title,
    detail: alert.detail,
    suggestedAction: alert.suggestedAction,
  }));
}

export async function fetchStockAiSummary(params: {
  companyName: string | null;
  alerts: StockInsight[];
}): Promise<StockAiSummaryResult | null> {
  const candidates = buildCandidates(params.alerts);
  if (candidates.length === 0) return null;

  const supabase = await getSupabaseClient();
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 15_000);

  try {
    const { data, error } = await supabase.functions.invoke("stock-alerts-ai", {
      body: {
        companyName: params.companyName,
        alerts: candidates,
      },
      signal: controller.signal,
    });

    if (error) throw error;

    const payload = (data ?? {}) as StockAiResponse;
    const summary = typeof payload.summary === "string" ? payload.summary.trim() : "";
    if (!summary) return null;

    return {
      summary,
      model: payload.meta?.model ?? null,
    };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("El analisis con IA demoro demasiado. Intenta nuevamente.");
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
