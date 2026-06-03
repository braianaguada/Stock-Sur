import { escapeHtml } from "@/lib/print";
import type { BillingDocumentLineRow, BillingDocumentRow, BillingRemitoReference } from "./types";

type BuildBillingPrintHtmlParams = {
  document: BillingDocumentRow;
  lines: BillingDocumentLineRow[];
  remito?: BillingRemitoReference | null;
  qrDataUrl?: string | null;
};

function formatMoney(value: number | string | null | undefined) {
  return Number(value ?? 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("es-AR");
}

function formatDocumentNumber(pointOfSale: number | null | undefined, number: number | null | undefined) {
  if (!pointOfSale || !number) return "-";
  return `${String(pointOfSale).padStart(5, "0")}-${String(number).padStart(8, "0")}`;
}

function buildRows(lines: BillingDocumentLineRow[]) {
  if (!lines.length) {
    return `
      <tr>
        <td colspan="5" class="empty">Sin lineas para mostrar.</td>
      </tr>
    `;
  }

  return lines.map((line) => `
    <tr>
      <td class="description">${escapeHtml(line.description)}</td>
      <td class="right nowrap">${Number(line.quantity).toLocaleString("es-AR")}</td>
      <td class="right">${formatMoney(line.unit_price)}</td>
      <td class="right nowrap">${Number(line.vat_rate).toLocaleString("es-AR", { minimumFractionDigits: 2 })}%</td>
      <td class="right">${formatMoney(line.total)}</td>
    </tr>
  `).join("");
}

export function buildBillingPrintHtml({ document, lines, remito, qrDataUrl }: BuildBillingPrintHtmlParams) {
  const issuerName = document.issuer_name?.trim() || "Razon social no configurada";
  const issuerTaxId = document.issuer_tax_id?.trim() || "CUIT emisor no configurado";
  const issuerTaxCondition = document.issuer_tax_condition?.trim() || "Condicion IVA no configurada";
  const missingIssuerData = !document.issuer_name?.trim() || !document.issuer_tax_id?.trim() || !document.issuer_tax_condition?.trim();
  const voucherNumber = document.voucher_full_number ?? formatDocumentNumber(document.point_of_sale, document.voucher_number);
  const receiverName = document.receiver_name?.trim() || "Consumidor Final";
  const receiverDocument = document.receiver_doc_number?.trim()
    ? `${document.receiver_doc_type} ${document.receiver_doc_number}`
    : "No informado";
  const remitoNumber = formatDocumentNumber(remito?.point_of_sale, remito?.document_number);

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Factura B ${escapeHtml(document.voucher_full_number ?? document.id)}</title>
  <style>
    * { box-sizing: border-box; }
    @page { size: A4; margin: 10mm; }
    html { background: #eef1f4; }
    body {
      margin: 0;
      background: #eef1f4;
      color: #111827;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      line-height: 1.35;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      justify-content: center;
      gap: 8px;
      padding: 12px;
      background: #111827;
    }
    .print-action {
      border: 0;
      border-radius: 6px;
      background: #ffffff;
      color: #111827;
      cursor: pointer;
      font-weight: 700;
      padding: 10px 16px;
    }
    .screen-warning {
      max-width: 794px;
      margin: 16px auto 0;
      border: 1px solid #f59e0b;
      background: #fffbeb;
      color: #92400e;
      padding: 10px 12px;
      font-weight: 700;
    }
    .page {
      width: min(794px, calc(100vw - 32px));
      min-height: 1123px;
      margin: 18px auto 28px;
      background: white;
      padding: 42px;
      box-shadow: 0 18px 50px rgba(15, 23, 42, 0.18);
    }
    .header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 96px minmax(0, 1fr);
      gap: 16px;
      align-items: stretch;
      border: 2px solid #111827;
      padding: 16px;
    }
    .issuer, .voucher-summary { min-width: 0; }
    .letter-box { display: grid; justify-items: center; align-content: start; gap: 6px; }
    .letter {
      display: grid;
      place-items: center;
      border: 2px solid #111827;
      width: 76px;
      height: 76px;
      font-size: 52px;
      font-weight: 800;
      line-height: 1;
    }
    .letter-caption { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #374151; }
    h1 { margin: 0 0 8px; font-size: 22px; line-height: 1.15; }
    h2 { margin: 0 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 0; }
    p { margin: 3px 0; }
    .label { color: #4b5563; font-weight: 700; }
    .right { text-align: right; }
    .nowrap { white-space: nowrap; }
    .muted { color: #4b5563; }
    .status-pill {
      display: inline-block;
      margin-top: 8px;
      border: 1px solid #111827;
      padding: 4px 8px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .section {
      margin-top: 14px;
      border: 1px solid #cbd5e1;
      padding: 12px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .section-grid { display: grid; grid-template-columns: 1.25fr 0.75fr; gap: 12px; }
    .origin-box {
      border-left: 4px solid #111827;
      background: #f8fafc;
      padding: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
      font-size: 12px;
      table-layout: fixed;
    }
    th {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 8px;
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
    }
    td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; }
    th.description-col { width: 44%; }
    th.qty-col { width: 13%; }
    th.money-col { width: 17%; }
    th.vat-col { width: 9%; }
    .description { overflow-wrap: anywhere; }
    .empty { text-align: center; color: #64748b; }
    .bottom-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 270px;
      gap: 20px;
      align-items: start;
      margin-top: 16px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .totals-box { border: 2px solid #111827; padding: 12px; }
    .total-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 5px 0;
    }
    .total-row.strong {
      border-top: 2px solid #111827;
      margin-top: 8px;
      padding-top: 10px;
      font-size: 18px;
      font-weight: 800;
    }
    .fiscal {
      display: grid;
      grid-template-columns: 118px minmax(0, 1fr);
      gap: 14px;
      align-items: center;
      border: 1px solid #cbd5e1;
      padding: 12px;
    }
    .qr {
      display: block;
      width: 112px;
      height: 112px;
      border: 1px solid #cbd5e1;
      object-fit: contain;
      background: white;
    }
    .qr-placeholder {
      display: grid;
      place-items: center;
      color: #64748b;
      font-size: 11px;
      text-align: center;
      padding: 8px;
    }
    .fiscal-title { font-size: 13px; font-weight: 800; text-transform: uppercase; }
    .warning { border: 1px solid #f59e0b; background: #fffbeb; color: #92400e; padding: 10px; margin-bottom: 12px; font-weight: 700; }
    .footer {
      margin-top: 18px;
      border-top: 1px solid #cbd5e1;
      padding-top: 10px;
      color: #4b5563;
      font-size: 11px;
      text-align: center;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    @media print {
      html, body { background: white; }
      .toolbar, .screen-warning, .no-print { display: none !important; }
      .page {
        width: 100%;
        max-width: 190mm;
        min-height: auto;
        margin: 0 auto;
        padding: 0;
        box-shadow: none;
      }
      .header, .section, table, .bottom-grid, .footer {
        break-inside: avoid;
        page-break-inside: avoid;
      }
    }
    @media (max-width: 760px) {
      .page { width: calc(100vw - 20px); padding: 22px; }
      .header, .section-grid, .bottom-grid { grid-template-columns: 1fr; }
      .letter-box { justify-items: start; }
      .right { text-align: left; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="print-action" onclick="window.print()">Imprimir / Guardar PDF</button>
  </div>
  ${missingIssuerData ? `
    <div class="screen-warning no-print">Completa razon social, CUIT y condicion IVA en Configuracion fiscal para mejorar la impresion.</div>
  ` : ""}
  <main class="page">
    ${document.fiscal_status !== "AUTHORIZED" || !document.cae ? `
      <div class="warning">Este comprobante no esta autorizado fiscalmente. No debe entregarse como factura fiscal.</div>
    ` : ""}
    <section class="header">
      <div class="issuer">
        <h1>${escapeHtml(issuerName)}</h1>
        <p><span class="label">CUIT:</span> ${escapeHtml(issuerTaxId)}</p>
        <p><span class="label">Condicion IVA:</span> ${escapeHtml(issuerTaxCondition)}</p>
        <p><span class="label">Ambiente:</span> Homologacion AFIPSDK dev</p>
      </div>
      <div class="letter-box">
        <div class="letter">B</div>
        <div class="letter-caption">Cod. 006</div>
      </div>
      <div class="voucher-summary right">
        <h1>Factura B</h1>
        <p><span class="label">Punto de venta:</span> ${escapeHtml(String(document.point_of_sale ?? "-"))}</p>
        <p><span class="label">Comprobante:</span> ${escapeHtml(voucherNumber)}</p>
        <p><span class="label">Fecha:</span> ${formatDate(document.voucher_date ?? document.created_at)}</p>
        <p><span class="label">CUIT emisor:</span> ${escapeHtml(issuerTaxId)}</p>
        <p><span class="label">Condicion IVA:</span> ${escapeHtml(issuerTaxCondition)}</p>
      </div>
    </section>

    <section class="section section-grid">
      <div class="receiver">
        <h2>Receptor</h2>
        <p><span class="label">Cliente:</span> ${escapeHtml(receiverName)}</p>
        <p><span class="label">Condicion IVA:</span> ${escapeHtml(document.receiver_tax_condition || "Consumidor Final")}</p>
        <p><span class="label">Documento:</span> ${escapeHtml(receiverDocument)}</p>
        <p><span class="label">Domicilio:</span> No informado</p>
      </div>
      <div class="origin-box">
        <h2>Origen interno</h2>
        <p><span class="label">Remito interno:</span> ${escapeHtml(remitoNumber)}</p>
        <p><span class="label">Caja / venta:</span> ${escapeHtml(document.source_id)}</p>
        <span class="status-pill">Homologacion / Dev</span>
      </div>
    </section>

    <table>
      <thead>
        <tr>
          <th class="description-col">Descripcion</th>
          <th class="right qty-col">Cantidad</th>
          <th class="right money-col">Precio unitario</th>
          <th class="right vat-col">IVA</th>
          <th class="right money-col">Total</th>
        </tr>
      </thead>
      <tbody>${buildRows(lines)}</tbody>
    </table>

    <section class="bottom-grid">
      <div class="fiscal">
        ${qrDataUrl ? `<img class="qr" src="${escapeHtml(qrDataUrl)}" alt="QR fiscal ARCA" />` : `<div class="qr qr-placeholder">QR fiscal pendiente</div>`}
        <div>
          <p class="fiscal-title">Autorizacion fiscal</p>
          <p><span class="label">Tipo autorizacion:</span> CAE</p>
          <p><span class="label">CAE:</span> ${escapeHtml(document.cae ?? "-")}</p>
          <p><span class="label">Vencimiento CAE:</span> ${escapeHtml(document.cae_expires_at ?? "-")}</p>
          <p class="muted">QR fiscal ARCA generado internamente.</p>
        </div>
      </div>
      <div class="totals-box">
        <div class="total-row"><span>Subtotal</span><strong>${formatMoney(document.subtotal)}</strong></div>
        <div class="total-row"><span>IVA</span><strong>${formatMoney(document.tax_total)}</strong></div>
        <div class="total-row"><span>Descuento</span><strong>${formatMoney(document.discount_total)}</strong></div>
        <div class="total-row strong"><span>Total</span><span>${formatMoney(document.total)}</span></div>
      </div>
    </section>

    <footer class="footer">
      Comprobante autorizado en ambiente de homologacion/dev. Vista imprimible interna de Stock Sur.
    </footer>
  </main>
</body>
</html>`;
}
