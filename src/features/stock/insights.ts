import type { StockRow } from "@/features/stock/types";

export type StockInsightTone = "RED" | "YELLOW" | "BLUE" | "GRAY";

export interface StockInsight {
  id: string;
  itemId: string;
  itemName: string;
  tone: StockInsightTone;
  kind:
    | "STOCKOUT"
    | "LOW_COVERAGE"
    | "DEMAND_SPIKE"
    | "OVERSTOCK"
    | "DORMANT_STOCK"
    | "NO_SIGNAL";
  priority: number;
  title: string;
  detail: string;
  suggestedAction: string;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function formatMonths(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "sin referencia util";
  if (value >= 60) return "mas de 60 meses";
  return `${round(value)} meses`;
}

function hasDemandSignal(row: StockRow) {
  return row.avg_daily_out_30d > 0 || row.avg_daily_out_90d > 0 || row.avg_daily_out_365d > 0;
}

function stockItemLabel(row: StockRow) {
  return row.item_sku ? `${row.item_name} · SKU ${row.item_sku}` : row.item_name;
}

function detailWithItemContext(row: StockRow, detail: string) {
  const context = [
    row.item_brand ? `Marca: ${row.item_brand}` : null,
    row.item_model ? `Modelo: ${row.item_model}` : null,
    row.item_attributes ? `Detalle: ${row.item_attributes}` : null,
    row.item_category ? `Categoría: ${row.item_category}` : null,
    row.item_supplier ? `Proveedor: ${row.item_supplier}` : null,
  ].filter((value): value is string => Boolean(value));

  return context.length > 0 ? `${context.join(" · ")}. ${detail}` : detail;
}

function buildDemandSpikeInsight(row: StockRow): StockInsight | null {
  if (row.low_rotation || row.total <= 0 || row.avg_daily_out_30d <= 0 || row.avg_daily_out_90d <= 0) {
    return null;
  }

  const ratio = row.avg_daily_out_30d / row.avg_daily_out_90d;
  if (ratio < 1.6) return null;

  return {
    id: `demand-spike-${row.item_id}`,
    itemId: row.item_id,
    itemName: row.item_name,
    tone: row.days_of_cover !== null && row.days_of_cover <= 20 ? "YELLOW" : "BLUE",
    kind: "DEMAND_SPIKE",
    priority: row.days_of_cover !== null && row.days_of_cover <= 20 ? 84 : 68,
    title: `${stockItemLabel(row)} aceleró su consumo`,
    detail: detailWithItemContext(row, `La salida diaria de 30 días está ${round(ratio)}x arriba de la ventana de 90 días. Cobertura actual: ${round(Math.max(0, row.days_of_cover ?? 0))} días.`),
    suggestedAction: "Revisar reposicion y validar si hubo cambio real de demanda o una venta puntual.",
  };
}

function buildDormantInsight(row: StockRow): StockInsight | null {
  if (row.total <= 0 || hasDemandSignal(row)) return null;

  return {
    id: `dormant-${row.item_id}`,
    itemId: row.item_id,
    itemName: row.item_name,
    tone: "BLUE",
    kind: "DORMANT_STOCK",
    priority: 58,
    title: `${stockItemLabel(row)} sin consumo reciente`,
    detail: detailWithItemContext(row, "Hay stock disponible pero no se detectan salidas en los últimos 365 días."),
    suggestedAction: "Validar si el item sigue activo, si conviene liquidarlo o dejarlo fuera de futuras compras.",
  };
}

function buildNoSignalInsight(row: StockRow): StockInsight | null {
  if (row.health !== "GRAY" || row.total !== 0 || hasDemandSignal(row)) return null;

  return {
    id: `no-signal-${row.item_id}`,
    itemId: row.item_id,
    itemName: row.item_name,
    tone: "GRAY",
    kind: "NO_SIGNAL",
    priority: 24,
    title: `${stockItemLabel(row)} todavía no tiene señal suficiente`,
    detail: detailWithItemContext(row, "No hay stock ni consumo histórico útil para estimar cobertura o riesgo."),
    suggestedAction: "Esperar mas movimientos o cargar una estimacion manual de demanda si el item es importante.",
  };
}

export function buildStockInsights(rows: StockRow[]): StockInsight[] {
  const insights: StockInsight[] = [];

  rows.forEach((row) => {
    if (row.total <= 0) {
      insights.push({
        id: `stockout-${row.item_id}`,
        itemId: row.item_id,
        itemName: row.item_name,
        tone: "RED",
        kind: "STOCKOUT",
        priority: 100,
        title: `${stockItemLabel(row)} sin stock`,
        detail: detailWithItemContext(row, row.days_of_cover !== null
          ? `La cobertura ya llegó a 0. Última estimación útil: ${round(Math.max(0, row.days_of_cover))} días.`
          : "No hay unidades disponibles y el ítem ya no tiene cobertura operativa."),
        suggestedAction: "Reponer urgente o frenar compromisos comerciales hasta confirmar abastecimiento.",
      });
      return;
    }

    if (row.low_rotation) {
      const months = row.months_of_cover_low_rotation;
      if (months !== null && months >= 18) {
        insights.push({
          id: `overstock-${row.item_id}`,
          itemId: row.item_id,
          itemName: row.item_name,
          tone: months >= 24 ? "YELLOW" : "BLUE",
          kind: "OVERSTOCK",
          priority: months >= 24 ? 76 : 62,
          title: `${stockItemLabel(row)} con sobrestock de baja rotación`,
          detail: detailWithItemContext(row, `Cobertura estimada: ${formatMonths(months)} para un ítem de rotación baja.`),
          suggestedAction: "Reducir futuras compras y revisar si conviene vender stock existente antes de reponer.",
        });
      }
    } else if (row.days_of_cover !== null) {
      if (row.days_of_cover <= 7) {
        insights.push({
          id: `critical-cover-${row.item_id}`,
          itemId: row.item_id,
          itemName: row.item_name,
          tone: "RED",
          kind: "LOW_COVERAGE",
          priority: 94,
          title: `${stockItemLabel(row)} con quiebre inminente`,
          detail: detailWithItemContext(row, `Cobertura estimada: ${round(row.days_of_cover)} días.`),
          suggestedAction: "Priorizar compra inmediata y revisar pedidos abiertos o proveedor alternativo.",
        });
      } else if (row.days_of_cover <= 15) {
        insights.push({
          id: `low-cover-${row.item_id}`,
          itemId: row.item_id,
          itemName: row.item_name,
          tone: "YELLOW",
          kind: "LOW_COVERAGE",
          priority: 78,
          title: `${stockItemLabel(row)} necesita reposición esta semana`,
          detail: detailWithItemContext(row, `Cobertura estimada: ${round(row.days_of_cover)} días.`),
          suggestedAction: "Programar reposicion antes de la proxima semana operativa.",
        });
      } else if (row.days_of_cover >= 90 && row.avg_daily_out_30d < row.avg_daily_out_365d * 0.4) {
        insights.push({
          id: `relative-overstock-${row.item_id}`,
          itemId: row.item_id,
          itemName: row.item_name,
          tone: "BLUE",
          kind: "OVERSTOCK",
          priority: 56,
          title: `${stockItemLabel(row)} con cobertura alta para el ritmo actual`,
          detail: detailWithItemContext(row, `Tiene ${round(row.days_of_cover)} días de cobertura y el consumo de 30 días viene desacelerado.`),
          suggestedAction: "Revisar si conviene espaciar la compra siguiente.",
        });
      }
    }

    const demandSpike = buildDemandSpikeInsight(row);
    if (demandSpike) insights.push(demandSpike);

    const dormant = buildDormantInsight(row);
    if (dormant) insights.push(dormant);

    const noSignal = buildNoSignalInsight(row);
    if (noSignal) insights.push(noSignal);
  });

  return insights.sort((left, right) => {
    if (right.priority !== left.priority) return right.priority - left.priority;
    return left.itemName.localeCompare(right.itemName);
  });
}

export function countStockInsightTones(insights: StockInsight[]) {
  return insights.reduce<Record<StockInsightTone, number>>(
    (accumulator, insight) => {
      accumulator[insight.tone] += 1;
      return accumulator;
    },
    {
      RED: 0,
      YELLOW: 0,
      BLUE: 0,
      GRAY: 0,
    },
  );
}

export function getStockInsightKindLabel(kind: StockInsight["kind"]) {
  switch (kind) {
    case "STOCKOUT":
      return "Sin stock";
    case "LOW_COVERAGE":
      return "Cobertura baja";
    case "DEMAND_SPIKE":
      return "Demanda acelerada";
    case "OVERSTOCK":
      return "Sobrestock";
    case "DORMANT_STOCK":
      return "Stock inmovilizado";
    case "NO_SIGNAL":
      return "Sin senal";
    default:
      return kind;
  }
}

