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
    .map((line) => `
      <tr>
        <td class="description">${escapeHtmlWithLineBreaks(line.description)}</td>
        <td>${escapeHtml(line.quantity ?? "-")}</td>
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
          @page{size:A4;margin:10mm}
          body{margin:0;background:#e5e7eb;color:#0f172a;font-family:Inter,Arial,sans-serif;font-size:12px;line-height:1.35}
          .sheet{width:190mm;min-height:277mm;margin:0 auto;background:#fff;padding:10mm;box-shadow:0 18px 60px rgba(15,23,42,.16)}
          .top{display:flex;justify-content:space-between;gap:16px;border-bottom:2px solid #0f172a;padding-bottom:14px}
          .brand{font-size:22px;font-weight:800;letter-spacing:.02em}
          .muted{color:#64748b}
          .docbox{text-align:right}
          .docbox h1{margin:0;font-size:20px}
          .badge{display:inline-block;margin-top:6px;border:1px solid #cbd5e1;border-radius:999px;padding:3px 9px;font-size:11px;font-weight:700}
          .grid{display:grid;grid-template-columns:1.2fr .8fr;gap:10px;margin-top:14px}
          .block{border:1px solid #e2e8f0;border-radius:10px;padding:10px}
          .label{font-size:10px;text-transform:uppercase;color:#64748b;font-weight:800}
          .value{margin-top:2px;font-weight:700}
          .text{margin-top:14px;white-space:normal}
          table{width:100%;border-collapse:collapse;margin-top:14px}
          th{background:#f1f5f9;color:#334155;text-align:left;font-size:10px;text-transform:uppercase;padding:7px;border-bottom:1px solid #cbd5e1}
          td{padding:7px;border-bottom:1px solid #e2e8f0;vertical-align:top}
          .description{width:52%}
          .money{text-align:right;white-space:nowrap}
          .totals{display:flex;justify-content:flex-end;margin-top:12px}
          .totalbox{min-width:70mm;border:1px solid #0f172a;border-radius:12px;padding:10px;background:#f8fafc}
          .totalrow{display:flex;justify-content:space-between;gap:20px}
          .grand{margin-top:6px;font-size:18px;font-weight:900}
          .conditions{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}
          .closing{margin-top:14px;border-top:1px solid #e2e8f0;padding-top:12px}
          .signature{margin-top:16px;width:55mm;border-top:1px solid #94a3b8;padding-top:6px;text-align:center;color:#64748b}
          .print-action{display:block;margin:12px auto 0;border:0;border-radius:999px;background:#0f172a;color:#fff;padding:9px 16px;font-weight:700;cursor:pointer}
          @media print{
            body{background:#fff}
            .sheet{width:auto;min-height:auto;margin:0;padding:0;box-shadow:none}
            .print-action{display:none}
          }
        </style>
      </head>
      <body>
        <main class="sheet">
          <section class="top">
            <div>
              <div class="brand">${escapeHtml(settings.name || "Stock Sur")}</div>
              <div class="muted">${escapeHtml(settings.address || "")}</div>
              <div class="muted">${escapeHtml(companyContact)}</div>
            </div>
            <div class="docbox">
              <h1>Presupuesto de servicio</h1>
              <div>SERV-${String(document.number).padStart(6, "0")}</div>
              <span class="badge">${escapeHtml(SERVICE_STATUS_LABEL[document.status])}</span>
            </div>
          </section>
          <section class="grid">
            <div class="block">
              <div class="label">Cliente</div>
              <div class="value">${escapeHtml(document.customers?.name ?? "Sin cliente")}</div>
              <div class="muted">${escapeHtml(document.customers?.cuit ?? "")}</div>
            </div>
            <div class="block">
              <div class="label">Fecha / referencia</div>
              <div class="value">${formatIsoDate(document.issue_date)}</div>
              <div class="muted">${escapeHtml(document.reference || "Sin referencia")}</div>
            </div>
          </section>
          <section class="text">${escapeHtmlWithLineBreaks(document.intro_text || "")}</section>
          <table>
            <thead><tr><th>Trabajo</th><th>Cant.</th><th>Unidad</th><th class="money">Precio</th><th class="money">Total</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="5" class="muted">Sin lineas cargadas</td></tr>'}</tbody>
          </table>
          <section class="totals">
            <div class="totalbox">
              <div class="totalrow"><span>Subtotal</span><strong>${currency.format(Number(document.subtotal ?? 0))}</strong></div>
              <div class="totalrow grand"><span>Total</span><span>${currency.format(Number(document.total ?? 0))}</span></div>
            </div>
          </section>
          <section class="conditions">
            <div class="block"><div class="label">Entrega</div><div>${escapeHtmlWithLineBreaks(document.delivery_time || "-")}</div></div>
            <div class="block"><div class="label">Pago</div><div>${escapeHtmlWithLineBreaks(document.payment_terms || "-")}</div></div>
            <div class="block"><div class="label">Lugar</div><div>${escapeHtmlWithLineBreaks(document.delivery_location || "-")}</div></div>
          </section>
          <section class="closing">${escapeHtmlWithLineBreaks(document.closing_text || "")}</section>
          <section class="signature">Firma y aclaracion</section>
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
