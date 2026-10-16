import type { CompanySettings } from "@/contexts/company-brand-context";
import { escapeHtml } from "@/lib/print";

export interface PrintBatch { firstNumber: number; secondNumber: number; sheetCount?: number; lastNumber?: number }

export interface FilledPurchaseOrder { number: number; supplier: string; form: Record<string, string>; totals: Partial<Record<"ARS" | "USD", number>>; lines: Array<{ description: string; quantity: number; currency: string; unitCost: number; total: number }> }

export function buildPurchaseOrderModelHtml(settings: CompanySettings, batch: PrintBatch, date: string, filled?: FilledPurchaseOrder) {
  const sheets = batch.sheetCount ?? 1;
  const lastNumber = batch.firstNumber + sheets * 2 - 1;
  if (!Number.isInteger(sheets) || sheets < 1 || sheets > 100 || !Number.isSafeInteger(batch.firstNumber) || batch.firstNumber < 1
    || !Number.isSafeInteger(lastNumber) || batch.secondNumber !== batch.firstNumber + 1
    || (batch.lastNumber !== undefined && batch.lastNumber !== lastNumber)) throw new Error("La numeración recibida no es válida.");
  const e = escapeHtml;
  const logo = settings.logo_url && /^(https?:\/\/|data:image\/(png|jpeg|webp);base64,)/i.test(settings.logo_url)
    ? `<img src="${e(settings.logo_url)}" alt="Logo" />` : "";
  const money = (value: number) => value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rowsPerPage = filled ? 4 : 12;
  const pages = filled ? Math.max(1, Math.ceil(filled.lines.length / rowsPerPage)) : sheets;
  const form = (number: number, page = 0) => `<article class="order">
    <header><div class="brand">${logo}<h1>${e(settings.legal_name || settings.app_name)}</h1>
      ${[settings.address, settings.phone, settings.email].filter(Boolean).map(value => `<p>${e(value!)}</p>`).join("")}
      <p>${e(settings.document_tagline || "")}</p></div>
      <div class="identity"><h2>ORDEN DE COMPRA</h2><strong>N° ${String(number).padStart(8, "0")}</strong><p>Fecha: ${e(date)}</p><p>CUIT 30-71158289-0</p></div></header>
    <div class="field">Proveedor:<span>${e(filled?.supplier ?? "")}</span></div><div class="field">Domicilio:<span>${e(filled?.form.address ?? "")}</span></div>
    <div class="field">Condición de compra:<span>${e(filled?.form.condition ?? "")}</span></div>
    <table><thead><tr><th class="qty">Cant.</th><th>Descripción</th><th class="price">P. unitario</th><th class="price">Importe</th></tr></thead>
      <tbody>${Array.from({ length: rowsPerPage }, (_, row) => { const line = filled?.lines[page * rowsPerPage + row]; return line ? `<tr><td>${e(String(line.quantity))}</td><td>${e(line.description)}</td><td>${e(line.currency)} ${money(line.unitCost)}</td><td>${money(line.total)}</td></tr>` : "<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>"; }).join("")}</tbody></table>
    <div class="field">Retira:<span>${e(filled?.form.collected_by ?? "")}</span></div><div class="field">Referencia:<span>${e(filled?.form.reference ?? "")}</span><b>${filled ? page === pages - 1 ? Object.entries(filled.totals).map(([currency, value]) => e(currency) + " " + money(value!)).join(" / ") : "Continua" : "Total $ __________"}</b></div>
    <div class="signatures"><div>Autorizado por:<span>${e(filled?.form.authorized_by ?? "")}</span></div><div>Preparado por:<span>${e(filled?.form.prepared_by ?? "")}</span></div></div>
    <footer>${filled ? e(filled.form.notes ?? "") + ` | Pag. ${page + 1}/${pages} | ` : ""}${e(settings.document_footer || (filled ? "Orden de compra" : "Formulario para completar manualmente"))}</footer></article>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Órdenes de compra ${filled ? filled.number : `${batch.firstNumber}-${lastNumber}`}</title>
    <style>@page{size:A4 landscape;margin:5mm}*{box-sizing:border-box}body{margin:0;font:10px Arial,sans-serif;color:#172033;background:white}
    .page{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:minmax(0,1fr);gap:0;width:287mm;height:200mm}.order{width:143.5mm;height:200mm;min-width:0;min-height:0;border:1px solid #334155;padding:0;display:flex;flex-direction:column;break-inside:avoid}.order+.order{border-left:0}
    header{display:grid;grid-template-columns:1fr 1fr;gap:3mm;min-height:34mm;flex-shrink:0;border-bottom:2px solid #334155;padding:3mm 2mm}
    h1{font-size:14px;margin:0 0 2mm}h2{font-size:13px;margin:0 0 3mm}p{margin:1mm 0;overflow-wrap:anywhere}.brand img{float:left;max-width:20mm;max-height:15mm;object-fit:contain;margin:0 2mm 2mm 0}.identity{text-align:right}.identity strong{font-size:16px}
    .field{display:flex;align-items:end;gap:2mm;min-height:7mm;flex-shrink:0;padding:0 2mm;border-bottom:1px solid #cbd5e1;font-weight:bold}.field span{flex:1;min-width:0;overflow-wrap:anywhere}.field b{font-size:11px;white-space:nowrap}
    table{width:100%;border-collapse:collapse;table-layout:fixed;margin:0;flex:1;min-height:91mm}th{background:#edf2f7;font-size:10px;text-align:left;height:7mm}td{height:7mm;overflow-wrap:anywhere;font-size:9px;line-height:1.15}td,th{border:1px solid #94a3b8;padding:1mm}tr>:first-child{border-left:0}tr>:last-child{border-right:0}.qty{width:13mm}.price{width:22mm}
    .signatures{display:grid;grid-template-columns:1fr 1fr;gap:5mm;padding:3mm 2mm;flex-shrink:0;min-height:20mm}.signatures span{display:block;border-bottom:1px solid #94a3b8;margin-top:7mm}footer{font-size:8px;color:#64748b;padding:2mm;margin:0;overflow-wrap:anywhere}
    .page{break-inside:avoid}.page:not(:last-child){break-after:page}
    @media screen{body{padding:8mm;background:#e2e8f0}.page{margin:0 auto 8mm}.order{background:white}}
    </style></head><body>${Array.from({ length: pages }, (_, index) => `<main class="page">${form(filled?.number ?? batch.firstNumber + index * 2, index)}${form(filled?.number ?? batch.firstNumber + index * 2 + 1, index)}</main>`).join("")}</body></html>`;
}
