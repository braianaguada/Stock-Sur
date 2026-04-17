import { currency, formatBusinessDate, formatDateTime, formatDocumentNumber } from "@/lib/formatters";
import { escapeHtml, escapeHtmlWithLineBreaks } from "@/lib/print";
import { PAYMENT_LABEL, RECEIPT_LABEL } from "./constants";
import type {
  CashClosureHistoryRow,
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
  const invoice = remito.external_invoice_number && remito.external_invoice_status === "ACTIVE"
    ? ` / Factura ${remito.external_invoice_number}`
    : "";
  const amount = Number.isFinite(Number(remito.total)) ? ` - ${currency.format(Number(remito.total))}` : "";
  return remito.customer_name ? `${number} - ${remito.customer_name}${amount}${invoice}` : `${number}${amount}${invoice}`;
}

export function normalizeReceiptSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function buildReceiptSearchText(remito: RemitoOption) {
  const paddedNumber = formatDocumentNumber(remito.point_of_sale, remito.document_number);
  const compactNumber = `${Number(remito.point_of_sale)}-${Number(remito.document_number ?? 0)}`;
  const invoiceNumber = remito.external_invoice_number ?? "";
  const amount = Number.isFinite(Number(remito.total)) ? Number(remito.total).toFixed(2) : "";
  return normalizeReceiptSearch(
    [
      paddedNumber,
      compactNumber,
      remito.customer_name,
      invoiceNumber,
      amount,
    ].filter(Boolean).join(" "),
  );
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
  if (eventType === "EXTERNAL_INVOICE_SET") return { title: "Factura externa registrada", tone: "info" as const };
  if (eventType === "EXTERNAL_INVOICE_CLEARED") return { title: "Factura externa quitada", tone: "warning" as const };
  if (eventType.includes("EMIT")) return { title: "Remito emitido", tone: "success" as const };
  if (eventType.includes("ANUL")) return { title: "Documento anulado", tone: "danger" as const };
  if (eventType.includes("CRE")) return { title: "Documento creado", tone: "info" as const };
  return { title: event.event_type.replaceAll("_", " "), tone: "neutral" as const };
}

export function getClosureSituationWithClosure(
  sale: CashSaleRow,
  closure: { status: string; closed_at: string | null } | null,
) {
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

  if (closure?.status === "CERRADO" && closure.closed_at) {
    return new Date(sale.sold_at) <= new Date(closure.closed_at)
      ? {
          label: "En caja cerrada",
          className: "border-emerald-200 bg-emerald-50 text-emerald-700",
        }
      : {
          label: "Venta post cierre",
          className: "border-violet-200 bg-violet-50 text-violet-700",
        };
  }

  if (closure?.status === "CERRADO") {
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

export function buildCashSummary(sales: CashSaleRow[]): CashSummary {
  return sales.reduce(
    (acc, sale) => {
      if (sale.status !== "ANULADA") {
        acc.total += Number(sale.amount_total);
        if (sale.payment_method === "EFECTIVO" || sale.payment_method === "EFECTIVO_REMITO") acc.efectivoRemito += Number(sale.amount_total);
        if (sale.payment_method === "EFECTIVO_FACTURABLE") acc.efectivoFacturable += Number(sale.amount_total);
        if (sale.payment_method === "SERVICIOS_REMITO") acc.serviciosRemito += Number(sale.amount_total);
        if (sale.payment_method === "POINT") acc.point += Number(sale.amount_total);
        if (sale.payment_method === "TRANSFERENCIA") acc.transferencia += Number(sale.amount_total);
        if (sale.payment_method === "CUENTA_CORRIENTE") acc.cuentaCorriente += Number(sale.amount_total);
      }
      if (sale.status === "PENDIENTE_COMPROBANTE") acc.pendientes += 1;
      return acc;
    },
    {
      efectivoRemito: 0,
      efectivoFacturable: 0,
      serviciosRemito: 0,
      point: 0,
      transferencia: 0,
      cuentaCorriente: 0,
      total: 0,
      pendientes: 0,
    },
  );
}

export function buildCashClosurePrintHtml({
  closure,
  sales,
  appName,
  documentFooter,
}: {
  closure: CashClosureHistoryRow;
  sales: CashSaleRow[];
  appName: string;
  documentFooter: string | null;
}) {
  const rows = sales.map((sale) => `
      <tr>
        <td>${new Date(sale.sold_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</td>
        <td>${escapeHtml(sale.customer_name_snapshot ?? "Consumidor final")}</td>
        <td>${escapeHtml(PAYMENT_LABEL[sale.payment_method])}</td>
        <td>${escapeHtml(sale.receipt_reference ?? RECEIPT_LABEL[sale.receipt_kind])}</td>
        <td style="text-align:right">${currency.format(Number(sale.amount_total))}</td>
      </tr>
    `).join("");

  return `<!doctype html><html><head><title>Cierre ${closure.business_date}</title><style>
      @page { size: A4 portrait; margin: 10mm; }
      * { box-sizing: border-box; }
      body{font-family:Arial,sans-serif;color:#0f172a;margin:0;font-size:11px;line-height:1.25}
      h1,h2,h3,p{margin:0}
      .sheet{width:100%;max-width:190mm;margin:0 auto}
      .header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px}
      .title{font-size:20px;font-weight:800;line-height:1}
      .sub{margin-top:4px;color:#64748b;font-size:10px}
      .status{border-radius:10px;background:#0f172a;color:#fff;padding:8px 10px;min-width:96px;text-align:right}
      .status .k{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#cbd5e1}
      .status .v{margin-top:4px;font-size:15px;font-weight:700}
      .grid{display:grid;grid-template-columns:1.2fr .8fr;gap:8px;margin-bottom:8px}
      .hero{border:1px solid #cbd5e1;border-radius:14px;padding:10px;background:linear-gradient(135deg,#fff,#f8fafc)}
      .hero-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:8px}
      .mini{border:1px solid #dbeafe;border-radius:10px;padding:8px;background:#fff}
      .mini.alt-green{border-color:#bbf7d0;background:#f0fdf4}
      .mini.alt-blue{border-color:#bfdbfe;background:#eff6ff}
      .mini.alt-violet{border-color:#ddd6fe;background:#f5f3ff}
      .eyebrow{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:#64748b}
      .big{margin-top:4px;font-size:18px;font-weight:800}
      .cards{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
      .card{border:1px solid #cbd5e1;border-radius:12px;padding:8px;background:#fff}
      .card strong{display:block;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;margin-bottom:4px}
      .manual-box{margin-top:6px;height:42px;border:1px dashed #cbd5e1;border-radius:10px;background:#f8fafc}
      .note{grid-column:1 / -1;border:1px dashed #cbd5e1;border-radius:12px;padding:8px;min-height:92px}
      table{width:100%;border-collapse:collapse;margin-top:8px;table-layout:fixed}
      thead th{font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:#64748b;border-bottom:1px solid #cbd5e1;padding:5px 6px;text-align:left}
      tbody td{border-bottom:1px solid #e2e8f0;padding:5px 6px;font-size:10px;vertical-align:top}
      tbody tr:last-child td{border-bottom:none}
      .right{text-align:right}
      .footer{display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:6px;border-top:1px solid #e2e8f0;color:#64748b;font-size:9px}
    </style></head><body>
      <div class="sheet">
        <div class="header">
          <div>
            <div class="title">Cierre diario ${formatBusinessDate(closure.business_date)}</div>
            <div class="sub">Generado por ${escapeHtml(appName)} · ${closure.status === "CERRADO" ? `Cerrado ${formatDateTime(closure.closed_at)}` : "Caja abierta"}</div>
          </div>
          <div class="status">
            <div class="k">Estado</div>
            <div class="v">${closure.status === "CERRADO" ? "Cerrado" : "Abierto"}</div>
          </div>
        </div>

        <div class="grid">
          <div class="hero">
            <div class="eyebrow">Resumen operativo</div>
            <div class="hero-grid">
              <div class="mini alt-green">
                <div class="eyebrow">Efectivo a rendir</div>
                <div class="big">${currency.format(Number(closure.expected_cash_to_render))}</div>
              </div>
              <div class="mini">
                <div class="eyebrow">Total ventas</div>
                <div class="big">${currency.format(Number(closure.expected_sales_total))}</div>
                <div class="sub">Movimientos: ${sales.length}</div>
              </div>
              <div class="mini">
                <div class="eyebrow">Efectivo remito</div>
                <div class="big">${currency.format(Number(closure.expected_cash_remito_total))}</div>
              </div>
              <div class="mini">
                <div class="eyebrow">Efectivo facturable</div>
                <div class="big">${currency.format(Number(closure.expected_cash_facturable_total))}</div>
              </div>
              <div class="mini alt-blue">
                <div class="eyebrow">Servicios / remito</div>
                <div class="big">${currency.format(Number(closure.expected_services_remito_total))}</div>
              </div>
              <div class="mini alt-blue">
                <div class="eyebrow">Point</div>
                <div class="big">${currency.format(Number(closure.expected_point_sales_total))}</div>
              </div>
              <div class="mini alt-violet">
                <div class="eyebrow">Transferencias</div>
                <div class="big">${currency.format(Number(closure.expected_transfer_sales_total))}</div>
              </div>
            </div>
          </div>

          <div class="cards">
            <div class="card">
              <strong>Efectivo real</strong>
              <div class="manual-box"></div>
            </div>
            <div class="card">
              <strong>Diferencia</strong>
              <div class="manual-box"></div>
            </div>
            <div class="note">
              <strong style="display:block;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#64748b;margin-bottom:4px">Notas</strong>
              <div>${escapeHtmlWithLineBreaks(closure.notes ?? "Sin observaciones")}</div>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:12%">Hora</th>
              <th style="width:30%">Cliente</th>
              <th style="width:16%">Pago</th>
              <th style="width:24%">Comprobante</th>
              <th class="right" style="width:18%">Importe</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="footer">
          <span>Hoja diaria de caja</span>
          <span>${escapeHtml(documentFooter ?? "Control interno")}</span>
        </div>
      </div>
    </body></html>`;
}

