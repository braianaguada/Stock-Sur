import type { CompanySettings } from "@/contexts/company-brand-context";
import { formatBusinessDate, formatMoney } from "@/lib/formatters";
import { escapeHtml, escapeHtmlWithLineBreaks, PRINT_BRAND_MARK, PRINT_FAVICON_TAG, renderOptionalPrintMeta } from "@/lib/print";
import { SERVICE_DOCUMENT_PREFIX, SERVICE_STATUS_LABEL } from "./constants";
import type { ServiceDocument, ServiceDocumentAttachment, ServiceDocumentLine } from "./types";

type BuildServiceDocumentPrintHtmlParams = {
  document: ServiceDocument;
  lines: ServiceDocumentLine[];
  attachments?: ServiceDocumentAttachment[];
  companySettings: CompanySettings;
};

function buildServiceRows(lines: ServiceDocumentLine[], showLinePrices: boolean, currencyCode: string) {
  if (lines.length === 0) {
    return `<tr><td colspan="${showLinePrices ? 5 : 4}" class="empty-row">Sin trabajos cargados</td></tr>`;
  }

  return lines
    .map(
      (line, index) => (line.line_type ?? "ITEM") !== "ITEM" ? `
        <tr class="section-row ${(line.line_type ?? "ITEM") === "TITLE" ? "section-title" : "section-subtitle"}">
          <td colspan="${showLinePrices ? 5 : 4}">${escapeHtml(line.description)}</td>
        </tr>
      ` : `
        <tr>
          <td class="c-index">${index + 1}</td>
          <td class="c-desc">${escapeHtml(line.description)}</td>
          <td class="c-qty">${Number(line.quantity ?? 0).toLocaleString("es-AR", { maximumFractionDigits: 2 })}</td>
          <td class="c-unit">${escapeHtml(line.unit ?? "-")}</td>
          ${showLinePrices ? `<td class="c-money">${formatMoney(line.line_total ?? 0, currencyCode)}</td>` : ""}
        </tr>
      `,
    )
    .join("");
}

function buildExchangeRateNote(document: ServiceDocument) {
  if (document.currency !== "USD" || !document.show_exchange_rate_note || !document.exchange_rate) return "";
  const rate = Number(document.exchange_rate);
  if (!Number.isFinite(rate) || rate <= 0) return "";
  const arsTotal = Number(document.total ?? 0) * rate;
  const source = document.exchange_rate_source === "MANUAL" ? "Cotizacion manual" : "Cotizacion de referencia Banco Nacion";
  const date = document.exchange_rate_date ? formatBusinessDate(document.exchange_rate_date) : "";
  return `
    <section class="exchange-note avoid-break">
      <strong>${escapeHtml(source)}</strong>
      <span>1 USD = ${formatMoney(rate, "ARS")}${date ? ` - tomada el ${escapeHtml(date)}` : ""}</span>
      <span>Equivalente estimado: ${formatMoney(arsTotal, "ARS")}</span>
    </section>
  `;
}

function buildAttachments(attachments: ServiceDocumentAttachment[]) {
  const visible = attachments.filter((attachment) => attachment.include_in_print && attachment.signed_url);
  if (visible.length === 0) return "";
  return `
    <section class="attachments-section">
      <p class="section-title">Imagenes / referencias</p>
      <div class="attachments-grid">
        ${visible.map((attachment) => `
          <figure class="attachment-card avoid-break">
            <img src="${escapeHtml(attachment.signed_url ?? "")}" alt="${escapeHtml(attachment.title || attachment.file_name)}" />
            ${attachment.title ? `<figcaption><strong>${escapeHtml(attachment.title)}</strong></figcaption>` : ""}
            ${attachment.description ? `<p>${escapeHtml(attachment.description)}</p>` : ""}
          </figure>
        `).join("")}
      </div>
    </section>
  `;
}

function getDensityClass(lineCount: number) {
  if (lineCount >= 16) return "density-dense";
  if (lineCount >= 8) return "density-compact";
  return "density-normal";
}

export function buildServiceDocumentPrintHtml({
  document,
  lines,
  attachments = [],
  companySettings,
}: BuildServiceDocumentPrintHtmlParams) {
  const isRemito = document.type === "REMITO";
  const documentLabel = isRemito ? "Remito de servicio" : "Presupuesto de servicio";
  const documentNumber = `${SERVICE_DOCUMENT_PREFIX}-${String(document.number).padStart(6, "0")}`;
  const legalName = companySettings.legal_name ?? companySettings.app_name ?? "Stock Sur";
  const appName = companySettings.app_name ?? legalName;
  const densityClass = getDensityClass(lines.length);
  const totalLabel = isRemito ? "Total servicio sin IVA" : "Total presupuesto sin IVA";
  const showLinePrices = document.pricing_mode !== "GLOBAL_TOTAL" && !document.hide_line_prices;
  const currencyCode = document.currency ?? "ARS";
  const logoMarkup = companySettings.logo_url
    ? `<img class="brand-logo" src="${escapeHtml(companySettings.logo_url)}" alt="${escapeHtml(appName)}" />`
    : `<div class="brand-fallback">${PRINT_BRAND_MARK}</div>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(documentNumber)}</title>
  ${PRINT_FAVICON_TAG}
  <style>
    @page{size:A4 portrait;margin:0}
    *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    html,body{margin:0;padding:0}
    body{font-family:Inter,Arial,sans-serif;color:#101828;background:#e7ebf0}
    .preview-shell{width:210mm;margin:0 auto;padding:6mm 0 10mm}
    .sheet{width:210mm;min-height:297mm;margin:0 auto;display:flex;flex-direction:column;background:#fff;border:1px solid #d0d7e2;border-radius:10px;box-shadow:0 18px 44px rgba(15,23,42,.12);overflow:hidden}
    .tone-service{--accent:#0d9488;--accent-soft:#f0fdfa;--accent-ink:#0f766e}
    .tone-service-quote{--accent:#2563eb;--accent-soft:#eff6ff;--accent-ink:#1d4ed8}
    .top-rule{height:4px;background:linear-gradient(90deg,#0f172a 0%,var(--accent) 100%)}
    .content{display:flex;min-height:calc(297mm - 4px);flex:1;flex-direction:column;padding:10mm 11mm 8.5mm}
    .header{display:grid;grid-template-columns:minmax(0,1fr) 64mm;gap:7mm;align-items:start;border-bottom:1px solid #d9e0ea;padding-bottom:4mm}
    .brand{display:grid;grid-template-columns:61mm minmax(0,1fr);gap:5mm;align-items:center;min-width:0}
    .brand-mark{display:grid;place-items:center;min-height:42mm;padding:1mm;border-right:1px solid #e3e8f0;box-sizing:border-box}
    .brand-logo{width:100%;height:100%;object-fit:contain}
    .brand-fallback{width:32mm;height:32mm;display:grid;place-items:center}
    .brand-fallback img{width:100%;height:100%;object-fit:contain}
    .brand-title{margin:0;color:#0f172a;font-size:17.5px;font-weight:850;line-height:1.08}
    .brand-sub{margin:1.2mm 0 0;color:#475569;font-size:8.1px;line-height:1.25}
    .company-meta{display:grid;grid-template-columns:1fr 1fr;gap:.8mm 3mm;margin-top:2.4mm;color:#64748b;font-size:7.7px;line-height:1.2}
    .company-meta span{overflow-wrap:anywhere}
    .doc-card{border:1px solid #cfd8e5;border-top:3px solid var(--accent);border-radius:6px;padding:3.5mm 4mm;background:linear-gradient(180deg,var(--accent-soft) 0%,#fff 100%)}
    .doc-kicker{margin:0 0 1.5mm;color:var(--accent-ink);font-size:7px;font-weight:900;letter-spacing:.22em;text-transform:uppercase}
    .doc-kind{margin:0;color:#0f172a;font-size:17px;font-weight:900;line-height:1.08}
    .doc-number{margin:2mm 0 0;color:#0f172a;font-family:Consolas,monospace;font-size:10.2px;font-weight:850}
    .doc-meta{display:grid;grid-template-columns:1fr 1fr;gap:1.4mm 3mm;margin-top:3mm}
    .status-chip{display:inline-block;width:max-content;margin-top:.3mm;border:1px solid color-mix(in srgb,var(--accent) 45%,white);border-radius:999px;padding:.5mm 1.6mm;background:#fff;color:var(--accent-ink);font-size:8px;font-weight:850}
    .badge-line span,.meta-line span{display:block;color:#64748b;font-size:7.3px;font-weight:780;letter-spacing:.08em;text-transform:uppercase}
    .badge-line strong,.meta-line strong{display:block;margin-top:.35mm;color:#0f172a;font-size:8.7px;line-height:1.18}
    .meta-grid{display:grid;grid-template-columns:1.02fr .98fr;gap:5mm;margin-top:3.3mm}
    .box{padding-top:2mm;border-top:1.5px solid #cfd8e5}
    .box-title{margin:0 0 1.5mm;color:#334155;font-size:7.5px;font-weight:900;letter-spacing:.2em;text-transform:uppercase}
    .meta-line{display:grid;grid-template-columns:25mm minmax(0,1fr);gap:2mm;align-items:baseline;padding:.5mm 0}
    .meta-line strong{font-weight:650;overflow-wrap:anywhere}
    .text-block{margin-top:3.6mm;min-height:13mm;border:1px dashed #c8d1df;border-radius:6px;padding:2.8mm;background:#fbfcfe}
    .text-block strong{display:block;margin-bottom:1.5mm;color:#475569;font-size:7.5px;letter-spacing:.16em;text-transform:uppercase}
    .text-block div{color:#334155;font-size:8.3px;line-height:1.35;white-space:pre-wrap}
    .conditions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4mm;margin-top:3.6mm}
    .condition{padding-top:2mm;border-top:1px solid #d9e0ea}
    .condition span{display:block;color:#64748b;font-size:7px;font-weight:850;letter-spacing:.14em;text-transform:uppercase}
    .condition strong{display:block;margin-top:.8mm;color:#0f172a;font-size:8.3px;line-height:1.25;font-weight:650;white-space:pre-wrap}
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
    .section-row td{background:#f1f5f9;border-top:1.5px solid #94a3b8;color:#0f172a}
    .section-title td{font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;padding-top:9px;padding-bottom:9px}
    .section-subtitle td{font-size:11px;font-weight:750;padding-top:7px;padding-bottom:7px}
    tr{break-inside:avoid;page-break-inside:avoid}
    thead{display:table-header-group}
    .c-index{width:8mm;text-align:center;color:#64748b}
    .c-desc{width:auto;font-weight:650;overflow-wrap:anywhere}
    .c-qty{width:14mm;text-align:right}
    .c-unit{width:10mm;text-transform:lowercase}
    .c-money{width:28mm;text-align:right;white-space:nowrap;font-weight:800}
    .lines-global-total .c-desc{width:auto}
    .empty-row{text-align:center;color:#64748b;padding:8mm}
    .summary-row{margin-top:auto;display:grid;grid-template-columns:minmax(0,1fr) 54mm;gap:6mm;align-items:start;padding-top:4mm}
    .totals{border-top:1.5px solid #cfd8e5;background:#fff}
    .totals-line{display:flex;justify-content:space-between;gap:3mm;padding:1.6mm 0;border-bottom:1px solid #e2e8f0;color:#475569;font-size:8.1px}
    .totals-line strong{color:#0f172a}
    .grand-total{padding:2.6mm 0 0;border-top:2px solid var(--accent);color:#0f172a}
    .grand-total span{display:block;color:var(--accent-ink);font-size:7px;font-weight:850;letter-spacing:.18em;text-transform:uppercase}
    .grand-total strong{display:block;margin-top:.8mm;font-size:18px;line-height:1;font-weight:950}
    .exchange-note{display:grid;gap:1mm;margin-top:3mm;border:1px solid #bfdbfe;border-radius:6px;background:#eff6ff;padding:2.3mm 3mm;color:#1e3a8a;font-size:8px}
    .exchange-note strong{font-size:7px;letter-spacing:.14em;text-transform:uppercase}
    .attachments-section{margin-top:5mm}
    .attachments-grid{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin-top:2mm}
    .attachment-card{margin:0;border:1px solid #d8e0ea;border-radius:7px;background:#fff;padding:2mm}
    .attachment-card img{display:block;width:100%;max-height:82mm;object-fit:contain;border-radius:5px;background:#f8fafc}
    .attachment-card figcaption{margin-top:1.6mm;color:#0f172a;font-size:8px}
    .attachment-card p{margin:1mm 0 0;color:#64748b;font-size:7.6px;line-height:1.25}
    .signature-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8mm;margin-top:12mm;color:#475569;font-size:7.6px}
    .is-service-quote .summary-row{grid-template-columns:66mm;justify-content:end}
    .is-service-quote .signature-row{display:none}
    .is-service-quote .totals{border:1px solid #c7d2fe;border-top:3px solid var(--accent);border-radius:7px;padding:2.2mm 3mm;background:linear-gradient(180deg,#fff 0%,var(--accent-soft) 100%)}
    .is-service-quote .grand-total strong{font-size:21px}
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
    <article class="sheet ${isRemito ? "tone-service is-service-remito" : "tone-service-quote is-service-quote"} ${densityClass}">
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
            <h2 class="doc-kind">${escapeHtml(documentLabel)}</h2>
            <p class="doc-number">${escapeHtml(documentNumber)}</p>
            <div class="doc-meta">
              <div class="badge-line"><span>Fecha</span><strong>${formatBusinessDate(document.issue_date)}</strong></div>
              <div class="badge-line"><span>Estado</span><strong class="status-chip">${escapeHtml(SERVICE_STATUS_LABEL[document.status])}</strong></div>
              ${document.valid_until ? `<div class="badge-line"><span>Vigencia</span><strong>${formatBusinessDate(document.valid_until)}</strong></div>` : ""}
            </div>
          </section>
        </header>

        <section class="meta-grid avoid-break">
          <div class="box">
            <p class="box-title">Cliente</p>
            ${renderOptionalPrintMeta("Nombre", document.customers?.name ?? "Sin cliente")}
            ${renderOptionalPrintMeta("CUIT", document.customers?.cuit)}
            ${renderOptionalPrintMeta("Telefono", document.customers?.phone)}
            ${renderOptionalPrintMeta("Email", document.customers?.email)}
          </div>
          <div class="box">
            <p class="box-title">Operacion</p>
            ${renderOptionalPrintMeta("Tipo", documentLabel)}
            ${renderOptionalPrintMeta("Referencia", document.reference)}
            ${renderOptionalPrintMeta("Creado", formatBusinessDate(document.issue_date))}
          </div>
        </section>

        ${document.intro_text ? `<section class="text-block avoid-break"><strong>Descripcion del servicio</strong><div>${escapeHtmlWithLineBreaks(document.intro_text)}</div></section>` : ""}

        <section class="conditions avoid-break">
          <div class="condition"><span>Plazo</span><strong>${escapeHtml(document.delivery_time || "-")}</strong></div>
          <div class="condition"><span>Cond. pago</span><strong>${escapeHtml(document.payment_terms || "-")}</strong></div>
          <div class="condition"><span>Lugar</span><strong>${escapeHtml(document.delivery_location || "-")}</strong></div>
        </section>

        <section class="lines-section">
          <div class="section-head">
            <p class="section-title">Trabajos</p>
            <span class="line-count">${lines.length} item${lines.length === 1 ? "" : "s"}</span>
          </div>
          <table class="${showLinePrices ? "" : "lines-global-total"}">
            <thead>
              <tr>
                <th class="c-index">#</th>
                <th class="c-desc">Descripcion</th>
                <th class="c-qty">Cant.</th>
                <th class="c-unit">Un.</th>
                ${showLinePrices ? `<th class="c-money">Importe</th>` : ""}
              </tr>
            </thead>
            <tbody>${buildServiceRows(lines, showLinePrices, currencyCode)}</tbody>
          </table>
        </section>

        ${document.closing_text ? `<section class="text-block avoid-break"><strong>Cierre</strong><div>${escapeHtmlWithLineBreaks(document.closing_text)}</div></section>` : ""}
        ${buildAttachments(attachments)}

        <section class="summary-row avoid-break">
          <div class="signature-row">
            <div class="signature-line">Recibi conforme</div>
            <div class="signature-line">Aclaracion</div>
            <div class="signature-line">Documento</div>
          </div>
          <div class="totals">
            <div class="totals-line"><span>Subtotal sin IVA</span><strong>${formatMoney(document.subtotal ?? 0, currencyCode)}</strong></div>
            <div class="totals-line"><span>IVA</span><strong>No incluido</strong></div>
            <div class="grand-total"><span>${escapeHtml(totalLabel)}</span><strong>${formatMoney(document.total ?? 0, currencyCode)}</strong></div>
            ${buildExchangeRateNote(document)}
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
