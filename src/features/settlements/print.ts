import type { EditableExpenseLine, EditableIncomeLine, SettlementHeaderForm, SettlementStatus } from "./types";
import { calculateSettlementTotals, editableLineTotal, formatSettlementNumber, settlementStatusLabel } from "./utils";
import { escapeHtml, PRINT_BRAND_MARK, PRINT_FAVICON_TAG } from "@/lib/print";
import { formatBusinessDate, formatDateTime } from "@/lib/formatters";

type BuildSettlementPrintHtmlParams = {
  companyName: string;
  companyLogoUrl?: string | null;
  settlementNumber: number | null;
  status: SettlementStatus;
  header: SettlementHeaderForm;
  createdAt: string;
  incomeLines: EditableIncomeLine[];
  expenseLines: EditableExpenseLine[];
  filterFrom?: string;
  filterTo?: string;
  printNote?: string;
  preparedByName?: string;
};

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const text = (value: string) => escapeHtml(value.trim() || "-");
const date = (value: string) => escapeHtml(value ? formatBusinessDate(value) : "-");

export function buildSettlementPrintHtml({
  companyName,
  companyLogoUrl,
  settlementNumber,
  status,
  header,
  createdAt,
  incomeLines,
  expenseLines,
  filterFrom,
  filterTo,
  printNote,
  preparedByName,
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
    : '<tr><td colspan="10" class="empty">Sin ingresos en las fechas seleccionadas</td></tr>';
  const expenseRows = expenseLines.length
    ? expenseLines.map((line) => `<tr>
        <td>${date(line.line_date)}</td><td>${text(line.receipt)}</td><td>${text(line.supplier_name)}</td>
        <td>${text(line.detail)}</td><td>${text(line.purchase_order)}</td>
        <td class="money strong">${money.format(editableLineTotal(line))}</td>
      </tr>`).join("")
    : '<tr><td colspan="6" class="empty">Sin egresos en las fechas seleccionadas</td></tr>';
  const selectedPeriod = filterFrom || filterTo
    ? `${filterFrom ? formatBusinessDate(filterFrom) : "Inicio"} a ${filterTo ? formatBusinessDate(filterTo) : "fin"}`
    : "Todas las fechas";
  const logoMarkup = companyLogoUrl
    ? `<img src="${escapeHtml(companyLogoUrl)}" alt="${escapeHtml(companyName)}" />`
    : PRINT_BRAND_MARK;

  return `<!doctype html>
<html><head><meta charset="utf-8" />${PRINT_FAVICON_TAG}
  <title>Rendicion ${escapeHtml(formatSettlementNumber(settlementNumber))}</title>
  <style>
    @page{size:A4 landscape;margin:0}
    *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    html,body{margin:0;padding:0}body{font-family:Inter,Arial,sans-serif;color:#101828;background:#e7ebf0}
    .preview{width:297mm;margin:0 auto;padding:6mm 0 10mm}.sheet{width:297mm;min-height:210mm;background:#fff;border:1px solid #d0d7e2;border-radius:10px;box-shadow:0 18px 44px rgba(15,23,42,.12);overflow:hidden}
    .rule{height:4px;background:linear-gradient(90deg,#0f172a 0%,#15803d 100%)}.content{min-height:206mm;padding:8mm 9mm;display:flex;flex-direction:column}
    .header{display:grid;grid-template-columns:minmax(0,1fr) 72mm;gap:7mm;border-bottom:1px solid #d9e0ea;padding-bottom:4mm}
    .brand{display:flex;align-items:center;gap:5mm}.mark{width:22mm;height:22mm;display:grid;place-items:center}.mark img{width:100%;height:100%;object-fit:contain}
    h1{margin:0;font-size:18px;font-weight:900}.brand p{margin:1mm 0 0;color:#64748b;font-size:8px}
    .doc{border:1px solid #bbd5c2;border-top:3px solid #15803d;border-radius:6px;padding:3mm 4mm;background:linear-gradient(180deg,#f0fdf4 0%,#fff 100%)}
    .doc span,.meta span{display:block;color:#64748b;font-size:7px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.doc strong{display:block;margin-top:.7mm;font-size:16px}
    .doc-grid,.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:2mm 5mm;margin-top:2.5mm}.doc-grid strong,.meta strong{font-size:8.4px}
    .meta-grid{grid-template-columns:repeat(4,1fr);margin:3.5mm 0;padding:3mm 0;border-bottom:1px solid #d9e0ea}.meta{min-width:0}.meta strong{display:block;margin-top:.7mm;overflow-wrap:anywhere}
    .section{margin-top:4mm}.section-head{display:flex;justify-content:space-between;align-items:end;margin-bottom:1.5mm}.section-head h2{margin:0;color:#475569;font-size:7.5px;font-weight:900;letter-spacing:.18em;text-transform:uppercase}.count{color:#64748b;font-size:8px}
    table{width:100%;border-collapse:collapse;table-layout:fixed;border-top:1.5px solid #cfd8e5}thead{display:table-header-group}th{background:#f5f7fa;color:#334155;font-size:6.5px;font-weight:850;text-align:left;text-transform:uppercase;border-bottom:1px solid #d8e0ea;padding:1.1mm}td{font-size:7.2px;line-height:1.15;border-bottom:1px solid #e6ebf2;padding:1.1mm;vertical-align:top;overflow-wrap:anywhere}tbody tr:nth-child(even){background:#fbfcfe}tr{break-inside:avoid;page-break-inside:avoid}.money{text-align:right;white-space:nowrap}.strong{font-weight:850}.empty{text-align:center;color:#64748b;padding:5mm}
    .summary{display:grid;grid-template-columns:1.35fr 1fr;gap:7mm;margin-top:auto;padding-top:5mm;break-inside:avoid}.notes{min-height:31mm;border:1px dashed #c8d1df;border-radius:6px;padding:3mm}.notes strong{font-size:7px;letter-spacing:.14em;text-transform:uppercase;color:#475569}
    .right{display:flex;flex-direction:column;gap:5mm}.totals{display:grid;grid-template-columns:repeat(3,1fr);gap:2mm}.total{border-top:1.5px solid #cfd8e5;padding:2mm}.total span{display:block;color:#64748b;font-size:7px;font-weight:800;text-transform:uppercase}.total strong{display:block;margin-top:1mm;font-size:12px}.total.grand{border-top:2px solid #15803d;background:#f0fdf4}
    .received{border:1px solid #cfd8e5;border-radius:6px;padding:2.5mm}.received-title{font-size:7px;font-weight:900;letter-spacing:.15em;text-transform:uppercase;color:#475569}.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm;margin-top:9mm}.line{border-top:1px solid #94a3b8;padding-top:1.5mm;text-align:center;color:#64748b;font-size:7px}
    footer{display:flex;justify-content:space-between;margin-top:4mm;padding-top:2mm;border-top:1px solid #e2e8f0;color:#64748b;font-size:7px}.print-action{display:block;margin:5mm auto 0;border:0;border-radius:999px;background:#0f172a;color:#fff;padding:10px 16px;font-size:13px;font-weight:750;cursor:pointer}
    @media print{body{background:#fff}.preview{width:297mm;padding:0}.sheet{width:297mm;min-height:210mm;border:0;border-radius:0;box-shadow:none;overflow:visible}.content{display:block;min-height:206mm}.header,.meta-grid,.section-head,.summary,footer{break-inside:avoid;page-break-inside:avoid}.summary{margin-top:8mm}.print-action{display:none}}
  </style></head><body><div class="preview"><article class="sheet"><div class="rule"></div><div class="content">
    <header class="header"><div class="brand"><div class="mark">${logoMarkup}</div><div><h1>${escapeHtml(companyName)}</h1><p>Control operativo de ingresos y egresos</p></div></div>
      <div class="doc"><span>Documento</span><strong>Rendicion ${escapeHtml(formatSettlementNumber(settlementNumber))}</strong><div class="doc-grid"><div><span>Fecha</span><strong>${date(header.settlement_date)}</strong></div><div><span>Estado</span><strong>${escapeHtml(settlementStatusLabel(status))}</strong></div></div></div>
    </header>
    <section class="meta-grid">
      <div class="meta"><span>Periodo rendicion</span><strong>${escapeHtml(selectedPeriod)}</strong></div>
      <div class="meta"><span>Preparado por</span><strong>${text(preparedByName || header.prepared_by_name)}</strong></div>
      <div class="meta"><span>Creado</span><strong>${escapeHtml(formatDateTime(createdAt))}</strong></div>
      <div class="meta"><span>Cantidad ingresos</span><strong>${incomeLines.length}</strong></div>
      <div class="meta"><span>Cantidad egresos</span><strong>${expenseLines.length}</strong></div>
    </section>
    <section class="section"><div class="section-head"><h2>Ingresos</h2><span class="count">${incomeLines.length} filas</span></div><table><thead><tr>
      <th>Fecha cobro</th><th>OT Nº</th><th>Recibo Nº</th><th>Presupuesto</th><th>Cliente</th><th>Concepto pago</th><th>Efectivo</th><th>Transf/Tarj/Cheq</th><th>Tipo</th><th>Total</th>
    </tr></thead><tbody>${incomeRows}</tbody></table></section>
    <section class="section"><div class="section-head"><h2>Egresos</h2><span class="count">${expenseLines.length} filas</span></div><table><thead><tr>
      <th>Fecha</th><th>FC Nº</th><th>Proveedor</th><th>Detalle</th><th>O/C</th><th>Efectivo</th>
    </tr></thead><tbody>${expenseRows}</tbody></table></section>
    <section class="summary"><div class="notes"><strong>Observaciones</strong><p>${text(printNote ?? "")}</p></div><div class="right">
      <div class="totals"><div class="total"><span>Total ingresos</span><strong>${money.format(totals.income_total)}</strong></div><div class="total"><span>Total egresos</span><strong>${money.format(totals.expense_total)}</strong></div><div class="total grand"><span>Total a rendir</span><strong>${money.format(totals.settlement_total)}</strong></div></div>
      <div class="received"><div class="received-title">Recibido</div><div class="signatures"><div class="line">Firma</div><div class="line">Aclaracion</div><div class="line">Fecha</div></div></div>
    </div></section>
    <footer><span>Generado por Stock Sur</span><span>Rendicion interna - control administrativo</span></footer>
  </div></article><button class="print-action" onclick="window.print()">Imprimir / Guardar PDF</button></div></body></html>`;
}
