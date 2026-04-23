import type { StockRow } from "@/features/stock/types";
import type { StockInsight, StockInsightTone } from "@/features/stock/insights";

type StockAiAlertPayload = {
  itemId?: string;
  tone?: string;
  title?: string;
  detail?: string;
  suggestedAction?: string;
  priority?: number;
  kind?: string;
};

type StockAiResponse = {
  summary?: string;
  alerts?: StockAiAlertPayload[];
  meta?: {
    model?: string;
  };
};

interface StockAiResult {
  summary: string | null;
  alerts: StockInsight[];
  model: string | null;
}

async function getSupabaseClient() {
  const module = await import("@/integrations/supabase/client");
  return module.supabase;
}

function normalizeTone(value: string | undefined): StockInsightTone {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "RED" || normalized === "YELLOW" || normalized === "BLUE" || normalized === "GRAY") {
    return normalized;
  }
  return "GRAY";
}

function normalizeKind(value: string | undefined): StockInsight["kind"] {
  const normalized = String(value ?? "").trim().toUpperCase();
  switch (normalized) {
    case "STOCKOUT":
    case "LOW_COVERAGE":
    case "DEMAND_SPIKE":
    case "OVERSTOCK":
    case "DORMANT_STOCK":
    case "NO_SIGNAL":
      return normalized;
    default:
      return "NO_SIGNAL";
  }
}

function buildCandidateRows(rows: StockRow[]) {
  const sorted = [...rows].sort((left, right) => {
    const leftPriority =
      (left.health === "RED" ? 100 : left.health === "YELLOW" ? 75 : 30) +
      (left.total <= 0 ? 40 : 0) +
      (left.days_of_cover !== null ? Math.max(0, 40 - left.days_of_cover) : 0) +
      (left.months_of_cover_low_rotation !== null ? Math.max(0, left.months_of_cover_low_rotation - 12) : 0);
    const rightPriority =
      (right.health === "RED" ? 100 : right.health === "YELLOW" ? 75 : 30) +
      (right.total <= 0 ? 40 : 0) +
      (right.days_of_cover !== null ? Math.max(0, 40 - right.days_of_cover) : 0) +
      (right.months_of_cover_low_rotation !== null ? Math.max(0, right.months_of_cover_low_rotation - 12) : 0);
    return rightPriority - leftPriority;
  });

  return sorted.slice(0, 40).map((row) => ({
    itemId: row.item_id,
    itemName: row.item_name,
    sku: row.item_sku,
    unit: row.item_unit,
    total: row.total,
    health: row.health,
    demandProfile: row.demand_profile,
    lowRotation: row.low_rotation,
    daysOfCover: row.days_of_cover,
    monthsOfCoverLowRotation: row.months_of_cover_low_rotation,
    avgDailyOut30: row.avg_daily_out_30d,
    avgDailyOut90: row.avg_daily_out_90d,
    avgDailyOut365: row.avg_daily_out_365d,
    demandDaily: row.demand_daily,
    demandMonthlyEstimate: row.demand_monthly_estimate,
  }));
}

export async function fetchStockAiAlerts(params: {
  companyName: string | null;
  rows: StockRow[];
}): Promise<StockAiResult | null> {
  const candidateRows = buildCandidateRows(params.rows);
  if (candidateRows.length === 0) return null;

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.functions.invoke("stock-alerts-ai", {
    body: {
      companyName: params.companyName,
      rows: candidateRows,
    },
  });

  if (error) throw error;

  const payload = (data ?? {}) as StockAiResponse;
  const rowsById = new Map(params.rows.map((row) => [row.item_id, row]));
  const alerts = (Array.isArray(payload.alerts) ? payload.alerts : [])
    .map((alert, index) => {
      const itemId = String(alert.itemId ?? "").trim();
      const row = rowsById.get(itemId);
      if (!itemId || !row) return null;

      const title = String(alert.title ?? "").trim();
      const detail = String(alert.detail ?? "").trim();
      const suggestedAction = String(alert.suggestedAction ?? "").trim();
      if (!title || !detail || !suggestedAction) return null;

      return {
        id: `ai-${itemId}-${index}`,
        itemId,
        itemName: row.item_name,
        tone: normalizeTone(alert.tone),
        kind: normalizeKind(alert.kind),
        priority: Number.isFinite(Number(alert.priority)) ? Number(alert.priority) : 50,
        title,
        detail,
        suggestedAction,
      } satisfies StockInsight;
    })
    .filter((alert): alert is StockInsight => alert !== null)
    .sort((left, right) => right.priority - left.priority);

  if (alerts.length === 0) return null;

  return {
    summary: typeof payload.summary === "string" ? payload.summary.trim() : null,
    alerts,
    model: payload.meta?.model ?? null,
  };
}
