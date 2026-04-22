import { formatDocumentNumber } from "@/lib/formatters";
import { STATUS_LABEL } from "./constants";
import type { DocEventRow, DocStatus, PriceListRow } from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const formatNumber = (n: number | null, pointOfSale: number) =>
  n === null ? "BORRADOR" : formatDocumentNumber(pointOfSale, n);

function applyPriceListRounding(value: number, roundMode: PriceListRow["round_mode"], roundTo: number | null) {
  switch (roundMode) {
    case "integer":
      return Math.round(value);
    case "tens":
      return Math.round(value / 10) * 10;
    case "hundreds":
      return Math.round(value / 100) * 100;
    case "x99":
      return value <= 0 ? 0 : Math.floor(value) + 0.99;
    case "none":
    default: {
      const safeRoundTo = !roundTo || roundTo <= 0 ? 1 : roundTo;
      if (safeRoundTo === 1) return value;
      return Math.round(value / safeRoundTo) * safeRoundTo;
    }
  }
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculatePriceFromCostBase(
  baseCost: number,
  fletePct: number | null,
  marginPct: number | null,
  ivaPct: number | null,
) {
  const fleteMultiplier = 1 + (Number(fletePct) || 0) / 100;
  const marginMultiplier = 1 + (Number(marginPct) || 0) / 100;
  const ivaMultiplier = 1 + (Number(ivaPct) || 0) / 100;
  return roundMoney(baseCost * fleteMultiplier * marginMultiplier * ivaMultiplier);
}

export function describeDocumentHistoryEvent(event: DocEventRow) {
  const payload = isRecord(event.payload) ? event.payload : null;

  switch (event.event_type) {
    case "EXTERNAL_INVOICE_SET": {
      const number = typeof payload?.external_invoice_number === "string" ? payload.external_invoice_number : null;
      return {
        title: "Factura externa registrada",
        detail: number ? `Se asoció la factura ${number}` : "Se registró una factura externa",
        tone: "info" as const,
      };
    }
    case "EXTERNAL_INVOICE_CLEARED":
      return {
        title: "Factura externa quitada",
        detail: "Se desvinculó la referencia fiscal externa",
        tone: "warning" as const,
      };
    case "CREATED": {
      const source = typeof payload?.source === "string" ? payload.source : null;
      const sourceNumber = typeof payload?.source_number === "string" ? payload.source_number : null;
      const sourceDocType = typeof payload?.source_doc_type === "string" ? payload.source_doc_type : null;
      return {
        title: source === "budget_conversion" ? "Remito creado" : "Documento creado",
        detail:
          source === "budget_conversion"
            ? `Creado a partir de ${sourceDocType === "PRESUPUESTO" ? "presupuesto" : "documento"} ${sourceNumber ?? ""}`.trim()
            : "Borrador inicial",
        tone: "neutral" as const,
      };
    }
    case "UPDATED":
      return {
        title: "Borrador actualizado",
        detail: "Se guardaron cambios",
        tone: "info" as const,
      };
    case "STATUS_CHANGED": {
      const from = typeof payload?.from === "string" ? payload.from : null;
      const to = typeof payload?.to === "string" ? payload.to : null;
      const fromLabel = from && from in STATUS_LABEL ? STATUS_LABEL[from as DocStatus] : from;
      const toLabel = to && to in STATUS_LABEL ? STATUS_LABEL[to as DocStatus] : to;
      const tone =
        to === "APROBADO" || to === "EMITIDO"
          ? "success"
          : to === "RECHAZADO"
            ? "warning"
            : to === "ANULADO"
              ? "danger"
              : "info";
      return {
        title: "Cambio de estado",
        detail: fromLabel && toLabel ? `${fromLabel} -> ${toLabel}` : "Estado actualizado",
        tone,
      };
    }
    case "REMITO_EMITIDO": {
      const reference = typeof payload?.reference === "string" ? payload.reference : null;
      return {
        title: "Remito emitido",
        detail: reference ? `Stock descontado (${reference})` : "Stock descontado automaticamente",
        tone: "success" as const,
      };
    }
    case "REMIO_CREATED_FROM_BUDGET":
    case "REMITO_CREATED_FROM_BUDGET": {
      const targetNumber = typeof payload?.target_number === "string" ? payload.target_number : null;
      const sourceNumber = typeof payload?.source_number === "string" ? payload.source_number : null;
      return {
        title: "Convertido a remito",
        detail:
          targetNumber && sourceNumber
            ? `Remito ${targetNumber} creado desde Presupuesto ${sourceNumber}`
            : targetNumber
              ? `Nuevo remito ${targetNumber}`
              : "Nuevo remito borrador",
        tone: "info" as const,
      };
    }
    default:
      return {
        title: event.event_type.replaceAll("_", " "),
        detail: "Movimiento registrado",
        tone: "neutral" as const,
      };
  }
}
