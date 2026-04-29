import { currency, formatIsoDate } from "@/lib/formatters";
import { escapeHtml, escapeHtmlWithLineBreaks } from "@/lib/print";
import { SERVICE_STATUS_LABEL } from "./constants";
import type { ServiceDocument, ServiceDocumentLine } from "./types";

type CompanyPrintSettings = {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
};

export function buildServiceDocumentPrintHtml(params: {
  document: ServiceDocument;
  lines: ServiceDocumentLine[];
  settings: CompanyPrintSettings;
}) {
  const { document, lines, settings } = params;
  const companyContact = [settings.phone, settings.email, settings.whatsapp].filter(Boolean).join(" | ");
  const rows = lines
    .map((line, index) => `
      <tr>
        <td class="index">${index + 1}</td>
        <td class="description">${escapeHtmlWithLineBreaks(line.description)}</td>
        <td class="numeric">${escapeHtml(line.quantity ?? "-")}</td>
        <td>${escapeHtml(line.unit ?? "-")}</td>
        <td class="money">${line.unit_price == null ? "-" : currency.format(Number(line.unit_price))}</td>
        <td class="money">${currency.format(Number(line.line_total ?? 0))}</td>
      </tr>
    `)
    .join("");

  return `<!doctype html>
    <html>
      <head>
        <title>Presupuesto SERV-${String(document.number).padStart(6, "0")}</title>
        <meta charset="utf-8" />
        <style>
          *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
          @page{size:A4;margin:8mm}
          body{margin:0;background:#eef2f7;color:#07152f;font-family:Inter,Arial,sans-serif;font-size:10px;line-height:1.35}
          .sheet{width:176mm;min-height:281mm;margin:8mm auto;background:#fff;border:1px solid #d6dee9;border-radius:14px;padding:8mm;box-shadow:0 24px 70px rgba(15,23,42,.14)}
          .hero{display:grid;grid-template-columns:1fr 1.05fr;gap:5mm}
          .brand-card,.doc-card,.info-card,.notes-card,.totalbox{border:1px solid #dbe4ef;border-radius:12px}
          .brand-card{min-height:47mm;padding:8mm 5mm;background:linear-gradient(145deg,#fff,#f1f6fd);display:flex;flex-direction:column;justify-content:space-between}
          .pill{display:inline-flex;width:max-content;border:1px solid #cbd8e8;border-radius:999px;padding:2px 9px;color:#718097;font-size:8px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
          .brand{font-size:18px;font-weight:900;letter-spacing:.03em}
          .muted{color:#607089}
          .company-lines{font-size:9px}
          .doc-card{min-height:47mm;padding:8mm 5mm;background:linear-gradient(145deg,#101b30,#1d2c45);color:#fff;display:flex;flex-direction:column;justify-content:space-between}
          .doc-card h1{margin:0;font-size:18px;letter-spacing:.01em}
          .doc-meta{font-size:9px;font-weight:800;line-height:1.55}
          .doc-meta span{color:#9bc8ff}
          .badge{display:inline-flex;width:max-content;border:1px solid rgba(255,255,255,.24);border-radius:999px;padding:3px 9px;font-size:9px;font-weight:800;background:rgba(255,255,255,.08)}
          .grid{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin-top:4mm}
          .info-card{padding:4mm;background:#fff}
          .label{font-size:8px;text-transform:uppercase;color:#64748b;font-weight:900;letter-spacing:.16em}
          .value{margin-top:2px;font-weight:800}
          .text{margin-top:4mm;padding:0 1mm;font-size:10px}
          table{width:100%;border-collapse:separate;border-spacing:0;margin-top:4mm;border:1px solid #dbe4ef;border-radius:12px;overflow:hidden}
          th{background:#edf3f9;color:#183153;text-align:left;font-size:8px;font-weight:900;padding:6px 8px;border-bottom:1px solid #dbe4ef}
          td{padding:7px 8px;border-bottom:1px solid #e6edf5;vertical-align:top}
          tbody tr:last-child td{border-bottom:0}
          .index{width:8mm;text-align:center;color:#51617a;font-weight:800}
          .description{width:45%}
          .numeric{text-align:right}
          .money{text-align:right;white-space:nowrap}
          .totals{display:flex;justify-content:flex-end;margin-top:4mm}
          .totalbox{width:58mm;padding:4mm;background:#f4f8fd}
          .totalrow{display:flex;justify-content:space-between;gap:10px}
          .totalrow span:first-child{color:#607089}
          .grand{margin-top:5px;font-size:18px;font-weight:950;letter-spacing:.01em}
          .conditions{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm;margin-top:4mm}
          .conditions .info-card{min-height:15mm}
          .closing{margin-top:4mm}
          .notes-card{min-height:19mm;border-style:dashed;padding:4mm;background:#fff}
          .signature{margin-top:5mm;width:52mm;border-top:1px solid #9aa8bc;padding-top:6px;text-align:center;color:#64748b}
          .footer{display:flex;justify-content:space-between;margin-top:6mm;color:#64748b;font-size:8px}
          .print-action{display:block;margin:12px auto 0;border:0;border-radius:999px;background:#0f172a;color:#fff;padding:9px 16px;font-weight:700;cursor:pointer}
          @media print{
            body{background:#fff}
            .sheet{width:auto;min-height:auto;margin:0;padding:0;border:0;border-radius:0;box-shadow:none}
            .print-action{display:none}
          }
        </style>
      </head>
      <body>
        <main class="sheet">
          <section class="hero">
            <div class="brand-card">
              <span class="pill">Presupuesto</span>
              <div>
              <div class="brand">${escapeHtml(settings.name || "Stock Sur")}</div>
                <div class="muted company-lines">${escapeHtml(settings.address || "")}</div>
                <div class="muted company-lines">${escapeHtml(companyContact)}</div>
              </div>
              <div class="muted">Documentacion comercial</div>
            </div>
            <div class="doc-card">
              <div>
              <h1>Presupuesto de servicio</h1>
                <div class="doc-meta">
                  <div><span>Nro:</span> SERV-${String(document.number).padStart(6, "0")}</div>
                  <div><span>Fecha:</span> ${formatIsoDate(document.issue_date)}</div>
                  <div><span>Estado:</span> ${escapeHtml(SERVICE_STATUS_LABEL[document.status])}</div>
                </div>
              </div>
              <span class="badge">${escapeHtml(SERVICE_STATUS_LABEL[document.status])}</span>
            </div>
          </section>
          <section class="grid">
            <div class="info-card">
              <div class="label">Cliente</div>
              <div class="value">${escapeHtml(document.customers?.name ?? "Sin cliente")}</div>
              <div class="muted">${escapeHtml(document.customers?.cuit ?? "")}</div>
            </div>
            <div class="info-card">
              <div class="label">Operacion</div>
              <div class="value">Presupuesto de servicio</div>
              <div class="muted">${escapeHtml(document.reference || "Sin referencia")}</div>
            </div>
          </section>
          <section class="text">${escapeHtmlWithLineBreaks(document.intro_text || "")}</section>
          <table>
            <thead><tr><th>#</th><th>Trabajo</th><th class="numeric">Cant.</th><th>Unidad</th><th class="money">P.Unit.</th><th class="money">Importe</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="6" class="muted">Sin lineas cargadas</td></tr>'}</tbody>
          </table>
          <section class="totals">
            <div class="totalbox">
              <div class="label">Total documento</div>
              <div class="totalrow"><span>Subtotal</span><strong>${currency.format(Number(document.subtotal ?? 0))}</strong></div>
              <div class="grand">${currency.format(Number(document.total ?? 0))}</div>
            </div>
          </section>
          <section class="conditions">
            <div class="info-card"><div class="label">Entrega</div><div>${escapeHtmlWithLineBreaks(document.delivery_time || "-")}</div></div>
            <div class="info-card"><div class="label">Pago</div><div>${escapeHtmlWithLineBreaks(document.payment_terms || "-")}</div></div>
            <div class="info-card"><div class="label">Lugar</div><div>${escapeHtmlWithLineBreaks(document.delivery_location || "-")}</div></div>
          </section>
          <section class="closing notes-card"><strong>Notas:</strong> ${escapeHtmlWithLineBreaks(document.closing_text || "-")}</section>
          <section class="signature">Firma y aclaracion</section>
          <section class="footer">
            <span>Generado por ${escapeHtml(settings.name || "Stock Sur")}</span>
            <span>Este documento no reemplaza comprobantes fiscales</span>
          </section>
        </main>
        <button class="print-action" onclick="window.print()">Imprimir / Guardar PDF</button>
      </body>
    </html>`;
}

export function writeServiceDocumentPrintWindow(win: Window, html: string) {
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  window.setTimeout(() => {
    win.focus();
    if (window.__STOCK_SUR_PRINT_SMOKE__) {
      window.__STOCK_SUR_PRINT_CALLED__ = (window.__STOCK_SUR_PRINT_CALLED__ ?? 0) + 1;
      return;
    }
    win.print();
  }, 250);
}

declare global {
  interface Window {
    __STOCK_SUR_PRINT_SMOKE__?: boolean;
    __STOCK_SUR_PRINT_CALLED__?: number;
  }
}
