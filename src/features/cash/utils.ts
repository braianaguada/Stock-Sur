import { formatDocumentNumber } from "@/lib/formatters";
import type {
  CashSaleRow,
  CashSummary,
  DocumentEventQuickRow,
  RemitoOption,
} from "./types";

export function todayDateInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

export function formatRemitoOptionLabel(remito: RemitoOption) {
  const number = formatDocumentNumber(remito.point_of_sale, remito.document_number);
  return remito.customer_name ? `${number} - ${remito.customer_name}` : number;
}

export function getClosureSituation(sale: CashSaleRow, hasClosedClosureForDay: boolean) {
  if (sale.status === "ANULADA") {
    return {
      label: "Anulada",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  if (sale.closure_id) {
    return {
      label: "En caja cerrada",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (hasClosedClosureForDay) {
    return {
      label: "Venta post cierre",
      className: "border-violet-200 bg-violet-50 text-violet-700",
    };
  }

  return {
    label: "Pendiente de cierre",
    className: "border-sky-200 bg-sky-50 text-sky-700",
  };
}

export function describeDocumentEvent(event: DocumentEventQuickRow) {
  const eventType = event.event_type.toUpperCase();
  if (eventType.includes("EMIT")) return { title: "Documento emitido", tone: "success" as const };
  if (eventType.includes("ANUL")) return { title: "Documento anulado", tone: "danger" as const };
  if (eventType.includes("CRE")) return { title: "Documento creado", tone: "info" as const };
  return { title: event.event_type.replaceAll("_", " "), tone: "neutral" as const };
}

export function buildCashSummary(sales: CashSaleRow[]): CashSummary {
  return sales.reduce(
    (acc, sale) => {
      if (sale.status !== "ANULADA") {
        acc.total += Number(sale.amount_total);
        if (sale.payment_method === "EFECTIVO") acc.efectivo += Number(sale.amount_total);
        if (sale.payment_method === "POINT") acc.point += Number(sale.amount_total);
        if (sale.payment_method === "TRANSFERENCIA") acc.transferencia += Number(sale.amount_total);
        if (sale.payment_method === "CUENTA_CORRIENTE") acc.cuentaCorriente += Number(sale.amount_total);
      }
      if (sale.status === "PENDIENTE_COMPROBANTE") acc.pendientes += 1;
      return acc;
    },
    { efectivo: 0, point: 0, transferencia: 0, cuentaCorriente: 0, total: 0, pendientes: 0 },
  );
}
