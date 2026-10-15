import type { CompanySettings } from "@/contexts/company-brand-context";
import { escapeHtml } from "@/lib/print";

export interface PrintBatch { firstNumber: number; secondNumber: number }

export function buildPurchaseOrderModelHtml(settings: CompanySettings, batch: PrintBatch, date: string) {
  const e = escapeHtml;
  const logo = settings.logo_url && /^(https?:\/\/|data:image\/(png|jpeg|webp);base64,)/i.test(settings.logo_url)
    ? `<img src="${e(settings.logo_url)}" alt="Logo" />` : "";
  const form = (number: number) => `<article class="order">
    <header><div class="brand">${logo}<h1>${e(settings.legal_name || settings.app_name)}</h1>
      ${[settings.address, settings.phone, settings.email].filter(Boolean).map(value => `<p>${e(value!)}</p>`).join("")}
      <p>${e(settings.document_tagline || "")}</p></div>
      <div class="identity"><h2>ORDEN DE COMPRA</h2><strong>N° ${String(number).padStart(8, "0")}</strong><p>Fecha: ${e(date)}</p><p>CUIT 30-71158289-0</p></div></header>
    <div class="field">Proveedor:<span></span></div><div class="field">Domicilio:<span></span></div>
    <div class="field">Condición de compra:<span></span></div>
    <table><thead><tr><th class="qty">Cant.</th><th>Descripción</th><th class="price">P. unitario</th><th class="price">Importe</th></tr></thead>
      <tbody>${Array.from({ length: 12 }, () => "<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>").join("")}</tbody></table>
    <div class="field">Retira:<span></span></div><div class="field">Referencia:<span></span><b>Total $ __________</b></div>
    <div class="signatures"><div>Autorizado por:<span></span></div><div>Preparado por:<span></span></div></div>
    <footer>${e(settings.document_footer || "Formulario para completar manualmente")}</footer></article>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Órdenes de compra ${batch.firstNumber}-${batch.secondNumber}</title>
    <style>@page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{margin:0;font:10px Arial,sans-serif;color:#172033;background:white}
    .page{display:grid;grid-template-columns:1fr 1fr;gap:6mm;width:281mm}.order{height:193mm;border:1px solid #334155;padding:4mm;display:flex;flex-direction:column;break-inside:avoid}
    header{display:grid;grid-template-columns:1fr 1fr;gap:3mm;min-height:34mm;border-bottom:2px solid #334155;padding-bottom:3mm}
    h1{font-size:14px;margin:0 0 2mm}h2{font-size:13px;margin:0 0 3mm}p{margin:1mm 0;overflow-wrap:anywhere}.brand img{float:left;max-width:20mm;max-height:15mm;object-fit:contain;margin:0 2mm 2mm 0}.identity{text-align:right}.identity strong{font-size:16px}
    .field{display:flex;align-items:end;gap:2mm;min-height:7mm;border-bottom:1px solid #cbd5e1;font-weight:bold}.field span{flex:1}.field b{font-size:11px;white-space:nowrap}
    table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:3mm}th{background:#edf2f7;font-size:10px;text-align:left;height:7mm}td{height:7mm}td,th{border:1px solid #94a3b8;padding:1mm}.qty{width:13mm}.price{width:22mm}
    .signatures{display:grid;grid-template-columns:1fr 1fr;gap:5mm;padding-top:4mm;flex:1;min-height:13mm}.signatures span{display:block;border-bottom:1px solid #94a3b8;margin-top:7mm}footer{font-size:8px;color:#64748b;margin-top:3mm;overflow-wrap:anywhere}
    @media screen{body{padding:8mm;background:#e2e8f0}.page{margin:auto}.order{background:white}}
    </style></head><body><main class="page">${form(batch.firstNumber)}${form(batch.secondNumber)}</main></body></html>`;
}
