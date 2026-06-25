import { currency, formatBusinessDate, formatDateTime, formatDocumentNumber, formatTime, todayBusinessDateInputValue } from "@/lib/formatters";
import { escapeHtml, escapeHtmlWithLineBreaks, PRINT_FAVICON_TAG } from "@/lib/print";
import { PAYMENT_LABEL, RECEIPT_LABEL } from "./constants";
import type {
  CashAdjustmentRow,
  CashClosureHistoryRow,
  CashExpenseFormState,
  CashExpenseRow,
  CashMovementRow,
  CashSaleRow,
  CashSummary,
  DocumentEventQuickRow,
  RemitoOption,
} from "./types";

export function todayDateInputValue() {
  return todayBusinessDateInputValue();
}

export function shouldAutoCloseCashClosure({
  enabled,
  configuredTime,
  businessDate,
  todayBusinessDate,
  currentHour,
  currentMinute,
  closureId,
  triggeredKey,
}: {
  enabled: boolean;
  configuredTime: string | null | undefined;
  businessDate: string;
  todayBusinessDate: string;
  currentHour: number;
  currentMinute: number;
  closureId: string;
  triggeredKey: string | null;
}) {
  if (!enabled || !configuredTime) return { shouldClose: false, nextTriggeredKey: triggeredKey };
  if (businessDate !== todayBusinessDate) return { shouldClose: false, nextTriggeredKey: triggeredKey };
  if (!Number.isFinite(currentHour) || !Number.isFinite(currentMinute)) {
    return { shouldClose: false, nextTriggeredKey: triggeredKey };
  }

  const [limitHour, limitMinute] = configuredTime.split(":").map(Number);
  if (!Number.isFinite(limitHour) || !Number.isFinite(limitMinute)) {
    return { shouldClose: false, nextTriggeredKey: triggeredKey };
  }

  const currentMinutes = currentHour * 60 + currentMinute;
  const limitMinutes = limitHour * 60 + limitMinute;
  const closureKey = `${businessDate}:${closureId}:${configuredTime}`;
  if (currentMinutes < limitMinutes || triggeredKey === closureKey) {
    return { shouldClose: false, nextTriggeredKey: triggeredKey };
  }

  return { shouldClose: true, nextTriggeredKey: closureKey };
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
  sale: CashMovementRow,
  closure: { status: string; closed_at: string | null } | null,
) {
  if (sale.status === "ANULADA") {
    return {
      label: "Anulada",
      tone: "danger" as const,
    };
  }

  if (sale.closure_id) {
    return {
      label: "En caja cerrada",
      tone: "success" as const,
    };
  }

  if (closure?.status === "CERRADO" && closure.closed_at) {
    return new Date(sale.sold_at) <= new Date(closure.closed_at)
      ? {
          label: "En caja cerrada",
          tone: "success" as const,
        }
      : {
          label: "Venta post cierre",
          tone: "primary" as const,
        };
  }

  if (closure?.status === "CERRADO") {
    return {
      label: "Venta post cierre",
      tone: "primary" as const,
    };
  }

  return {
    label: "Pendiente de cierre",
    tone: "info" as const,
  };
}

export function parseCashExpenseAmount(value: string) {
  return Number(value.replace(",", "."));
}

export function validateCashExpenseForm(form: CashExpenseFormState) {
  const amount = parseCashExpenseAmount(form.amount);
  if (!form.businessDate) return "La fecha operativa es obligatoria";
  if (!form.category) return "La categoria es obligatoria";
  if (!form.description.trim()) return "La descripcion es obligatoria";
  if (!Number.isFinite(amount) || amount <= 0) return "El monto debe ser mayor a cero";
  return null;
}

export function buildCashExpenseSummary(expenses: CashExpenseRow[]) {
  return expenses.reduce(
    (acc, expense) => {
      if (expense.cancelled_at) return acc;
      const amount = Number(expense.amount_total);
      acc.total += amount;
      if (expense.expense_kind === "CAJA") {
        acc.cash += amount;
      } else {
        acc.nonCash += amount;
      }
      acc.byCategory[expense.category] = (acc.byCategory[expense.category] ?? 0) + amount;
      return acc;
    },
    {
      total: 0,
      cash: 0,
      nonCash: 0,
      byCategory: {} as Partial<Record<CashExpenseRow["category"], number>>,
    },
  );
}

export function buildCashSummary(
  sales: CashSaleRow[],
  expenses: CashExpenseRow[] = [],
  adjustments: CashAdjustmentRow[] = [],
): CashSummary {
  const salesSummary = sales.reduce(
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

  const expenseSummary = buildCashExpenseSummary(expenses);
  const adjustmentsTotal = adjustments.reduce((acc, adjustment) => {
    if (adjustment.cancelled_at) return acc;
    return acc + Number(adjustment.signed_amount);
  }, 0);
  return {
    ...salesSummary,
    serviciosRemito: salesSummary.serviciosRemito + adjustmentsTotal,
    total: salesSummary.total + adjustmentsTotal,
    gastosTotal: expenseSummary.total,
    gastosEfectivo: expenseSummary.cash,
    gastosNoEfectivo: expenseSummary.nonCash,
    efectivoAntesGastos: salesSummary.efectivoRemito + salesSummary.efectivoFacturable,
    efectivoNetoEsperado: salesSummary.efectivoRemito + salesSummary.efectivoFacturable - expenseSummary.cash,
  };
}

export function buildCashClosurePrintHtml({
  closure,
  movements,
  appName,
  documentFooter,
}: {
  closure: CashClosureHistoryRow;
  movements: CashMovementRow[];
  appName: string;
  documentFooter: string | null;
}) {
  const rows = movements.map((movement) => `
      <tr>
        <td>${formatTime(movement.sold_at)}</td>
        <td>${escapeHtml(movement.customer_name_snapshot ?? "Consumidor final")}</td>
        <td>${escapeHtml(PAYMENT_LABEL[movement.payment_method])}</td>
        <td>${escapeHtml(movement.receipt_reference ?? RECEIPT_LABEL[movement.receipt_kind])}</td>
        <td style="text-align:right">${currency.format(Number(movement.display_amount))}</td>
      </tr>
    `).join("");

  return `<!doctype html><html><head><title>Cierre ${closure.business_date}</title>${PRINT_FAVICON_TAG}<style>
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
                <div class="eyebrow">Gastos efectivo</div>
                <div class="big">${currency.format(Number(closure.expected_cash_expenses_total))}</div>
              </div>
              <div class="mini">
                <div class="eyebrow">Total ventas</div>
                <div class="big">${currency.format(Number(closure.expected_sales_total))}</div>
                <div class="sub">Movimientos: ${movements.length}</div>
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



