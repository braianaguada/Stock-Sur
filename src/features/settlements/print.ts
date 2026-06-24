import type { EditableExpenseLine, EditableIncomeLine, SettlementHeaderForm, SettlementStatus } from "./types";
import { calculateSettlementTotals, editableLineTotal, formatSettlementNumber, settlementStatusLabel } from "./utils";
import { escapeHtml, PRINT_FAVICON_TAG } from "@/lib/print";
import { formatBusinessDate } from "@/lib/formatters";

type BuildSettlementPrintHtmlParams = {
  companyName: string;
  settlementNumber: number | null;
  status: SettlementStatus;
  header: SettlementHeaderForm;
  incomeLines: EditableIncomeLine[];
  expenseLines: EditableExpenseLine[];
  filterFrom?: string;
  filterTo?: string;
};

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

const text = (value: string) => escapeHtml(value.trim() || "-");
const date = (value: string) => escapeHtml(value ? formatBusinessDate(value) : "-");

export function buildSettlementPrintHtml({
  companyName,
  settlementNumber,
  status,
  header,
  incomeLines,
  expenseLines,
  filterFrom,
  filterTo,
}: BuildSettlementPrintHtmlParams) {
  const totals = calculateSettlementTotals(incomeLines, expenseLines);
  const incomeRows = incomeLines.length
    ? incomeLines.map((line) => `<tr>
        <td>${date(line.line_date)}</td><td>${text(line.work_order)}</td><td>${text(line.receipt)}</td>
        <td>${text(line.quote)}</td><td>${text(line.customer_name)}</td><td>${text(line.concept)}</td>
        <td class="money">${money.format(Number(line.cash_amount || 0))}</td>
        <td class="money">${money.format(Number(line.other_amount || 0))}</td><td>${text(line.income_type)}</td>
        <td class="money strong">${money.format(editableLineTotal(line))}</td>
      </tr>`).join("")
    : '<tr><td colspan="10" class="empty">Sin ingresos en el periodo seleccionado</td></tr>';
  const expenseRows = expenseLines.length
    ? expenseLines.map((line) => `<tr>
        <td>${date(line.line_date)}</td><td>${text(line.receipt)}</td><td>${text(line.supplier_name)}</td>
        <td>${text(line.detail)}</td><td>${text(line.purchase_order)}</td>
        <td class="money strong">${money.format(editableLineTotal(line))}</td>
      </tr>`).join("")
    : '<tr><td colspan="6" class="empty">Sin egresos en el periodo seleccionado</td></tr>';
  const period = filterFrom || filterTo
    ? `Filtrado: ${filterFrom ? formatBusinessDate(filterFrom) : "inicio"} a ${filterTo ? formatBusinessDate(filterTo) : "fin"}`
    : "Detalle completo";

  return `<!doctype html><html><head><meta charset="utf-8" />${PRINT_FAVICON_TAG}
  <title>Rendicion ${escapeHtml(formatSettlementNumber(settlementNumber))}</title>
  <style>
    @page{size:A4 landscape;margin:9mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;margin:0;font-size:9px}
    header{display:flex;justify-content:space-between;border-bottom:2px solid #172033;padding-bottom:8px;margin-bottom:10px}
    h1{font-size:20px;margin:0 0 4px}h2{font-size:13px;margin:14px 0 5px}.meta{text-align:right;line-height:1.5}
    table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #b9c1cc;padding:4px;vertical-align:top;overflow-wrap:anywhere}
    th{background:#eef1f5;text-align:left;font-size:8px}.money{text-align:right;white-space:nowrap}.strong{font-weight:700}.empty{text-align:center;padding:12px;color:#667085}
    .totals{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}.total{border:1px solid #98a2b3;padding:8px}.total strong{display:block;font-size:15px;margin-top:3px}
    .footer{display:grid;grid-template-columns:1.5fr 1fr;gap:12px;margin-top:16px;break-inside:avoid}.box{border:1px solid #98a2b3;min-height:85px;padding:8px}
    .signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:44px}.line{border-top:1px solid #344054;padding-top:4px;text-align:center}
    .print-action{position:fixed;right:12px;top:12px;padding:8px 12px}@media print{.print-action{display:none}}
  </style></head><body>
  <button class="print-action" onclick="window.print()">Imprimir / Guardar PDF</button>
  <header><div><h1>Rendicion ${escapeHtml(formatSettlementNumber(settlementNumber))}</h1>
    <div>${escapeHtml(companyName)} · ${escapeHtml(settlementStatusLabel(status))}</div></div>
    <div class="meta"><strong>Fecha de rendicion:</strong> ${date(header.settlement_date)}<br />
    <strong>Preparado por:</strong> ${text(header.prepared_by_name)}<br />${escapeHtml(period)}</div></header>
  <h2>Ingresos (${incomeLines.length})</h2><table><thead><tr>
    <th>FECHA COBRO</th><th>OT Nº</th><th>RECIBO Nº</th><th>PRESUPUESTO</th><th>CLIENTE</th>
    <th>CONCEPTO PAGO</th><th>EFECTIVO</th><th>TRANSF/TARJ/CHEQ</th><th>TIPO</th><th>TOTAL</th>
  </tr></thead><tbody>${incomeRows}</tbody></table>
  <h2>Egresos (${expenseLines.length})</h2><table><thead><tr>
    <th>FECHA</th><th>FC Nº</th><th>PROVEEDOR</th><th>DETALLE</th><th>O/C</th><th>EFECTIVO</th>
  </tr></thead><tbody>${expenseRows}</tbody></table>
  <div class="totals"><div class="total">Total ingresos<strong>${money.format(totals.income_total)}</strong></div>
    <div class="total">Total egresos<strong>${money.format(totals.expense_total)}</strong></div>
    <div class="total">Total a rendir<strong>${money.format(totals.settlement_total)}</strong></div></div>
  <div class="footer"><div class="box"><strong>Observaciones</strong></div><div class="box"><strong>Recibido</strong>
    <div class="signatures"><div class="line">Firma</div><div class="line">Aclaracion</div><div class="line">Fecha</div></div></div></div>
  </body></html>`;
}
