import type { CompanySettings } from "@/contexts/company-brand-context";
import { escapeHtml, PRINT_BRAND_MARK, PRINT_FAVICON_TAG } from "@/lib/print";
import { formatDateTime, formatIsoDate } from "@/lib/formatters";
import { DOC_LABEL, INTERNAL_REMITO_LABEL, STATUS_LABEL } from "./constants";
import type { DocLineRow, DocRow } from "./types";
import { formatNumber, resolveDocumentRecipient } from "./utils";

type PrintableLine = Pick<
  DocLineRow,
  "line_order" | "sku_snapshot" | "description" | "quantity" | "unit" | "unit_price" | "line_total"
>;

type BuildDocumentPrintHtmlParams = {
  document: DocRow;
  lines: PrintableLine[];
  companySettings: CompanySettings;
  technicianName?: string | null;
};

const moneyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 2,
});

function optionalMeta(label: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  return `<div class="meta-line"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function optionalBadge(label: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  return `<div class="badge-line"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function buildRows(lines: PrintableLine[]) {
  if (lines.length === 0) {
    return `<tr><td colspan="6" class="empty-row">Sin productos cargados</td></tr>`;
  }

  return lines
    .map(
      (line) => `
        <tr>
          <td class="c-index">${line.line_order}</td>
          <td class="c-desc">${escapeHtml(line.description)}</td>
          <td class="c-qty">${numberFormatter.format(Number(line.quantity))}</td>
          <td class="c-unit">${escapeHtml(line.unit ?? "un")}</td>
          <td class="c-money">${moneyFormatter.format(Number(line.unit_price))}</td>
          <td class="c-money c-total">${moneyFormatter.format(Number(line.line_total))}</td>
        </tr>
      `,
    )
    .join("");
}

function getDensityClass(lineCount: number) {
  if (lineCount >= 19) return "density-dense";
  if (lineCount >= 9) return "density-compact";
  return "density-normal";
}

function getDocumentTone(docType: DocRow["doc_type"]) {
  if (docType === "PRESUPUESTO") return "tone-budget";
  if (docType === "REMITO_DEVOLUCION") return "tone-return";
  return "tone-remito";
}

export function buildDocumentPrintHtml({
  document,
  lines,
  companySettings,
  technicianName,
}: BuildDocumentPrintHtmlParams) {
  const documentTypeLabel = DOC_LABEL[document.doc_type];
  const hasDocumentNumber = document.document_number !== null && document.document_number !== undefined;
  const documentNumber = hasDocumentNumber
    ? formatNumber(document.document_number, document.point_of_sale)
    : "Pendiente de numeracion";
  const densityClass = getDensityClass(lines.length);
  const documentToneClass = getDocumentTone(document.doc_type);
  const documentKindClass = document.doc_type === "PRESUPUESTO" ? "is-budget" : "is-remito";
  const legalName = companySettings.legal_name ?? companySettings.app_name;
  const title = `${documentTypeLabel} ${documentNumber}`;
  const totalLabel = document.doc_type === "PRESUPUESTO" ? "Total presupuesto" : "Total documento";
  const sourceLabel =
    document.source_document_type && document.source_document_number_snapshot
      ? `${DOC_LABEL[document.source_document_type]} ${document.source_document_number_snapshot}`
      : null;
  const externalInvoice =
    document.external_invoice_number
      ? `${document.external_invoice_number}${document.external_invoice_date ? ` - ${formatIsoDate(document.external_invoice_date)}` : ""}`
      : null;

  const logoMarkup = companySettings.logo_url
    ? `<img class="brand-logo" src="${escapeHtml(companySettings.logo_url)}" alt="${escapeHtml(companySettings.app_name)}" />`
    : `<div class="brand-fallback">${PRINT_BRAND_MARK}</div>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  ${PRINT_FAVICON_TAG}
  <style>
    @page{size:A4 portrait;margin:0}
    *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    html,body{margin:0;padding:0}
    body{font-family:Inter,Arial,sans-serif;color:#101828;background:#e7ebf0}
    .preview-shell{width:210mm;margin:0 auto;padding:6mm 0 10mm}
    .sheet{width:210mm;min-height:297mm;margin:0 auto;display:flex;flex-direction:column;background:#fff;border:1px solid #d0d7e2;border-radius:10px;box-shadow:0 18px 44px rgba(15,23,42,.12);overflow:hidden}
    .tone-budget{--accent:#2563eb;--accent-soft:#eff6ff;--accent-ink:#1d4ed8}
    .tone-remito{--accent:#15803d;--accent-soft:#f0fdf4;--accent-ink:#166534}
    .tone-return{--accent:#b45309;--accent-soft:#fffbeb;--accent-ink:#92400e}
    .top-rule{height:4px;background:linear-gradient(90deg,#0f172a 0%,var(--accent) 100%)}
    .content{display:flex;min-height:calc(297mm - 4px);flex:1;flex-direction:column;padding:10mm 11mm 8.5mm}
    .header{display:grid;grid-template-columns:minmax(0,1fr) 62mm;gap:7mm;align-items:start;border-bottom:1px solid #d9e0ea;padding-bottom:4mm}
    .brand{display:grid;grid-template-columns:55mm minmax(0,1fr);gap:5mm;align-items:center;min-width:0}
    .brand-mark{display:grid;place-items:center;min-height:38mm;padding:1.2mm;border-right:1px solid #e3e8f0}
    .brand-logo{max-width:51mm;max-height:37mm;object-fit:contain}
    .brand-fallback{width:32mm;height:32mm;display:grid;place-items:center}
    .brand-fallback img{width:100%;height:100%;object-fit:contain}
    .brand-title{margin:0;color:#0f172a;font-size:17.5px;font-weight:850;line-height:1.08;letter-spacing:0}
    .brand-sub{margin:1.2mm 0 0;color:#475569;font-size:8.1px;line-height:1.25}
    .company-meta{display:grid;grid-template-columns:1fr 1fr;gap:.8mm 3mm;margin-top:2.4mm;color:#64748b;font-size:7.7px;line-height:1.2}
    .company-meta span{overflow-wrap:anywhere}
    .doc-card{border:1px solid #cfd8e5;border-top:3px solid var(--accent);border-radius:6px;padding:3.5mm 4mm;background:linear-gradient(180deg,var(--accent-soft) 0%,#fff 100%)}
    .doc-kicker{margin:0 0 1.5mm;color:var(--accent-ink);font-size:7px;font-weight:900;letter-spacing:.22em;text-transform:uppercase}
    .doc-kind{margin:0;color:#0f172a;font-size:18px;font-weight:900;line-height:1}
    .doc-number{margin:2mm 0 0;color:#0f172a;font-family:Consolas,monospace;font-size:10.2px;font-weight:850}
    .doc-number.is-pending{font-family:Inter,Arial,sans-serif;color:#475569;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}
    .doc-meta{display:grid;grid-template-columns:1fr 1fr;gap:1.4mm 3mm;margin-top:3mm}
    .status-chip{display:inline-block;width:max-content;margin-top:.3mm;border:1px solid color-mix(in srgb,var(--accent) 45%,white);border-radius:999px;padding:.5mm 1.6mm;background:#fff;color:var(--accent-ink);font-size:8px;font-weight:850}
    .badge-line span,.meta-line span{display:block;color:#64748b;font-size:7.3px;font-weight:780;letter-spacing:.08em;text-transform:uppercase}
    .badge-line strong,.meta-line strong{display:block;margin-top:.35mm;color:#0f172a;font-size:8.8px;line-height:1.18}
    .meta-grid{display:grid;grid-template-columns:1.02fr .98fr;gap:5mm;margin-top:3.3mm}
    .box{padding-top:2mm;border-top:1.5px solid #cfd8e5}
    .box-title{margin:0 0 1.5mm;color:#334155;font-size:7.5px;font-weight:900;letter-spacing:.2em;text-transform:uppercase}
    .meta-line{display:grid;grid-template-columns:22mm minmax(0,1fr);gap:2mm;align-items:baseline;padding:.5mm 0}
    .meta-line span{font-size:7.3px}
    .meta-line strong{font-size:8.7px;font-weight:650;overflow-wrap:anywhere}
    .notes{min-height:15mm;border:1px dashed #c8d1df;border-radius:6px;padding:2.8mm;background:#fbfcfe}
    .notes strong{display:block;margin-bottom:1.5mm;color:#475569;font-size:7.5px;letter-spacing:.16em;text-transform:uppercase}
    .notes pre{margin:0;color:#334155;font-family:inherit;font-size:8.3px;line-height:1.35;white-space:pre-wrap}
    .service-notes{margin-top:3.6mm}
    .lines-section{margin-top:4.5mm}
    .section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:4mm;margin-bottom:1.8mm}
    .section-title{margin:0;color:#475569;font-size:7.5px;font-weight:850;letter-spacing:.2em;text-transform:uppercase}
    .line-count{color:#64748b;font-size:8px}
    table{width:100%;border-collapse:collapse;table-layout:fixed;border-top:1.5px solid #cfd8e5;border-bottom:1px solid #d8e0ea}
    th{height:5mm;background:#f5f7fa;color:#334155;font-size:7px;font-weight:850;letter-spacing:.08em;text-align:left;text-transform:uppercase;border-bottom:1px solid #d8e0ea;padding:1.2mm 1.4mm}
    td{height:5.5mm;color:#111827;font-size:8px;line-height:1.12;vertical-align:top;border-bottom:1px solid #e6ebf2;padding:1.2mm 1.4mm}
    .density-compact th{height:4.6mm;padding:1mm 1.25mm}
    .density-compact td{height:5mm;font-size:7.8px;padding:1mm 1.25mm}
    .density-dense th{height:4.2mm;font-size:6.7px;padding:.8mm 1mm}
    .density-dense td{height:4.55mm;font-size:7.45px;line-height:1.08;padding:.8mm 1mm}
    tbody tr:nth-child(even){background:#fbfcfe}
    tbody tr:last-child td{border-bottom:0}
    tr{break-inside:avoid;page-break-inside:avoid}
    thead{display:table-header-group}
    .c-index{width:8mm;text-align:center;color:#64748b}
    .c-desc{width:auto;font-weight:650;overflow-wrap:anywhere}
    .c-qty{width:13mm;text-align:right}
    .c-unit{width:8mm;text-transform:lowercase}
    .c-money{width:23mm;text-align:right;white-space:nowrap}
    .c-total{font-weight:800}
    .empty-row{text-align:center;color:#64748b;padding:8mm}
    .summary-row{margin-top:auto;display:grid;grid-template-columns:minmax(0,1fr) 52mm;gap:6mm;align-items:start;padding-top:4mm}
    .totals{border-top:1.5px solid #cfd8e5;background:#fff}
    .totals-line{display:flex;justify-content:space-between;gap:3mm;padding:1.6mm 0;border-bottom:1px solid #e2e8f0;color:#475569;font-size:8.1px}
    .totals-line strong{color:#0f172a}
    .grand-total{padding:2.6mm 0 0;border-top:2px solid var(--accent);color:#0f172a}
    .grand-total span{display:block;color:#475569;font-size:7px;font-weight:850;letter-spacing:.18em;text-transform:uppercase}
    .grand-total strong{display:block;margin-top:.8mm;font-size:18px;line-height:1;font-weight:950;letter-spacing:0}
    .is-budget .summary-row{grid-template-columns:66mm;justify-content:end}
    .is-budget .totals{border:1px solid #c7d2fe;border-top:3px solid var(--accent);border-radius:7px;padding:2.2mm 3mm;background:linear-gradient(180deg,#fff 0%,var(--accent-soft) 100%)}
    .is-budget .totals-line{padding:1.35mm 0;font-size:8.3px}
    .is-budget .grand-total{margin-top:1mm;padding:2.5mm 0 0;border-top:2px solid var(--accent)}
    .is-budget .grand-total span{color:var(--accent-ink)}
    .is-budget .grand-total strong{font-size:21px;color:#0f172a}
    .signature-row{display:none;grid-template-columns:1fr 1fr 1fr;gap:8mm;margin-top:12mm;color:#475569;font-size:7.6px}
    .is-remito .signature-row{display:grid}
    .signature-line{padding-top:8mm;border-top:1px solid #cbd5e1;text-align:center}
    .footer{display:flex;justify-content:space-between;gap:5mm;margin-top:4mm;padding-top:2.5mm;border-top:1px solid #e2e8f0;color:#64748b;font-size:7.7px;line-height:1.3}
    .print-action{display:block;margin:5mm auto 0;border:0;border-radius:999px;background:#0f172a;color:#fff;padding:10px 16px;font-size:13px;font-weight:750;box-shadow:0 10px 22px rgba(15,23,42,.20);cursor:pointer}
    .avoid-break{break-inside:avoid;page-break-inside:avoid}
    @media print{
      body{background:white}
      .preview-shell{width:210mm;padding:0}
      .sheet{width:210mm;min-height:297mm;border:0;border-radius:0;box-shadow:none}
      .content{min-height:calc(297mm - 4px)}
      .print-action{display:none}
    }
  </style>
</head>
<body>
  <div class="preview-shell">
    <article class="sheet ${documentToneClass} ${densityClass} ${documentKindClass}">
      <div class="top-rule"></div>
      <div class="content">
        <header class="header avoid-break">
          <section class="brand">
            <div class="brand-mark">${logoMarkup}</div>
            <div>
              <h1 class="brand-title">${escapeHtml(legalName)}</h1>
              <p class="brand-sub">${escapeHtml(companySettings.document_tagline ?? "Documentacion comercial")}</p>
              <div class="company-meta">
                ${companySettings.tax_id ? `<span>CUIT ${escapeHtml(companySettings.tax_id)}</span>` : ""}
                ${companySettings.address ? `<span>${escapeHtml(companySettings.address)}</span>` : ""}
                ${companySettings.phone ? `<span>${escapeHtml(companySettings.phone)}</span>` : ""}
                ${companySettings.email ? `<span>${escapeHtml(companySettings.email)}</span>` : ""}
              </div>
            </div>
          </section>
          <section class="doc-card">
            <p class="doc-kicker">Documento</p>
            <h2 class="doc-kind">${escapeHtml(documentTypeLabel)}</h2>
            <p class="doc-number ${hasDocumentNumber ? "" : "is-pending"}">${escapeHtml(documentNumber)}</p>
            <div class="doc-meta">
              ${optionalBadge("Fecha", formatIsoDate(document.issue_date))}
              <div class="badge-line"><span>Estado</span><strong class="status-chip">${escapeHtml(STATUS_LABEL[document.status])}</strong></div>
              ${document.valid_until ? optionalBadge("Validez", formatIsoDate(document.valid_until)) : ""}
              ${optionalBadge("PDV", String(document.point_of_sale).padStart(4, "0"))}
            </div>
          </section>
        </header>

        <section class="meta-grid avoid-break">
          <div class="box">
            <p class="box-title">Cliente</p>
            ${optionalMeta("Cliente", resolveDocumentRecipient(document, { technicianName }).primaryName)}
            ${resolveDocumentRecipient(document, { technicianName }).secondaryName ? optionalMeta("Nombre ocasional", resolveDocumentRecipient(document, { technicianName }).secondaryName) : ""}
          </div>
          <div class="box">
            <p class="box-title">Operacion</p>
            ${optionalMeta("Tipo", documentTypeLabel)}
            ${technicianName ? optionalMeta("Tecnico", technicianName) : ""}
            ${document.doc_type !== "REMITO_DEVOLUCION" && document.internal_remito_type ? optionalMeta("Imputacion", INTERNAL_REMITO_LABEL[document.internal_remito_type]) : ""}
            ${sourceLabel ? optionalMeta("Origen", sourceLabel) : ""}
            ${externalInvoice ? optionalMeta("Factura ext.", externalInvoice) : ""}
            ${document.payment_terms ? optionalMeta("Cond. venta", document.payment_terms) : ""}
            ${document.salesperson ? optionalMeta("Vendedor", document.salesperson) : ""}
            ${document.delivery_address ? optionalMeta("Entrega", document.delivery_address) : ""}
            ${optionalMeta("Creado", formatDateTime(document.created_at))}
          </div>
        </section>

        <section class="notes service-notes avoid-break">
          <strong>Notas</strong>
          <pre>${escapeHtml(document.notes ?? "-")}</pre>
        </section>

        <section class="lines-section">
          <div class="section-head">
            <p class="section-title">Productos</p>
            <span class="line-count">${lines.length} item${lines.length === 1 ? "" : "s"}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th class="c-index">#</th>
                <th class="c-desc">Descripcion</th>
                <th class="c-qty">Cant.</th>
                <th class="c-unit">Un.</th>
                <th class="c-money">P.Unit.</th>
                <th class="c-money">Importe</th>
              </tr>
            </thead>
            <tbody>${buildRows(lines)}</tbody>
          </table>
        </section>

        <section class="summary-row avoid-break">
          <div class="signature-row">
            <div class="signature-line">Recibi conforme</div>
            <div class="signature-line">Aclaracion</div>
            <div class="signature-line">Documento</div>
          </div>
          <div class="totals">
            <div class="totals-line"><span>Subtotal</span><strong>${moneyFormatter.format(Number(document.subtotal ?? 0))}</strong></div>
            <div class="totals-line"><span>IVA / Imp.</span><strong>${moneyFormatter.format(Number(document.tax_total ?? 0))}</strong></div>
            <div class="grand-total"><span>${escapeHtml(totalLabel)}</span><strong>${moneyFormatter.format(Number(document.total ?? 0))}</strong></div>
          </div>
        </section>

        <footer class="footer">
          <span>Generado por ${escapeHtml(companySettings.app_name)}</span>
          <span>${escapeHtml(companySettings.document_footer ?? "Este documento no reemplaza comprobantes fiscales")}</span>
        </footer>
      </div>
    </article>
    <button class="print-action" onclick="window.print()">Imprimir / Guardar PDF</button>
  </div>
</body>
</html>`;
}
