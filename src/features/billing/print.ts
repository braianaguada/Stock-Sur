import { escapeHtml } from "@/lib/print";
import type { BillingDocumentLineRow, BillingDocumentRow, BillingRemitoReference } from "./types";
import { buildFiscalQrUrl } from "./lib/authorization";

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
  return lines.map((line) => `
    <tr>
      <td>${escapeHtml(line.description)}</td>
      <td class="right">${Number(line.quantity).toLocaleString("es-AR")}</td>
      <td class="right">${formatMoney(line.unit_price)}</td>
      <td class="right">${Number(line.vat_rate).toLocaleString("es-AR", { minimumFractionDigits: 2 })}%</td>
      <td class="right">${formatMoney(line.total)}</td>
    </tr>
  `).join("");
}

export function buildBillingPrintHtml({ document, lines, remito, qrDataUrl }: BuildBillingPrintHtmlParams) {
  const fiscalQrUrl = buildFiscalQrUrl(document);

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Factura B ${escapeHtml(document.voucher_full_number ?? document.id)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f4f5f7; color: #111827; font-family: Arial, Helvetica, sans-serif; }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: white; padding: 14mm; }
    .toolbar { position: sticky; top: 0; display: flex; justify-content: flex-end; gap: 8px; padding: 10px; background: #111827; }
    .print-action { border: 0; border-radius: 6px; background: #ffffff; color: #111827; cursor: pointer; font-weight: 700; padding: 9px 14px; }
    .header { display: grid; grid-template-columns: 1fr 92px 1fr; gap: 16px; align-items: start; border: 1px solid #111827; padding: 14px; }
    .letter { display: grid; place-items: center; border: 2px solid #111827; height: 84px; font-size: 52px; font-weight: 800; }
    h1 { margin: 0 0 8px; font-size: 22px; }
    h2 { margin: 0 0 8px; font-size: 15px; }
    p { margin: 3px 0; font-size: 12px; line-height: 1.35; }
    .right { text-align: right; }
    .muted { color: #4b5563; }
    .section { margin-top: 14px; border: 1px solid #d1d5db; padding: 12px; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 12px; }
    th { background: #f3f4f6; border: 1px solid #d1d5db; padding: 7px; text-align: left; }
    td { border: 1px solid #d1d5db; padding: 7px; vertical-align: top; }
    .totals { display: grid; grid-template-columns: 1fr 82mm; gap: 18px; margin-top: 14px; }
    .totals-box { border: 1px solid #111827; padding: 10px; }
    .total-row { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; }
    .total-row.strong { border-top: 1px solid #111827; margin-top: 6px; padding-top: 8px; font-size: 16px; font-weight: 800; }
    .fiscal { display: grid; grid-template-columns: 120px 1fr; gap: 12px; align-items: center; }
    .qr { width: 112px; height: 112px; border: 1px solid #d1d5db; }
    .warning { border: 1px solid #f59e0b; background: #fffbeb; color: #92400e; padding: 10px; }
    @media print {
      body { background: white; }
      .toolbar { display: none; }
      .page { width: auto; min-height: auto; margin: 0; padding: 10mm; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="print-action" onclick="window.print()">Imprimir / Guardar PDF</button>
  </div>
  <main class="page">
    ${document.fiscal_status !== "AUTHORIZED" || !document.cae ? `
      <div class="warning">Este comprobante no esta autorizado fiscalmente. No debe entregarse como factura fiscal.</div>
    ` : ""}
    <section class="header">
      <div>
        <h1>${escapeHtml(document.issuer_name ?? "Emisor sin razon social")}</h1>
        <p>CUIT: ${escapeHtml(document.issuer_tax_id ?? "-")}</p>
        <p>Condicion IVA: ${escapeHtml(document.issuer_tax_condition ?? "-")}</p>
      </div>
      <div class="letter">B</div>
      <div class="right">
        <h1>Factura B</h1>
        <p>Comprobante: ${escapeHtml(document.voucher_full_number ?? formatDocumentNumber(document.point_of_sale, document.voucher_number))}</p>
        <p>Fecha: ${formatDate(document.voucher_date ?? document.created_at)}</p>
        <p>CAE: ${escapeHtml(document.cae ?? "-")}</p>
        <p>Vto. CAE: ${formatDate(document.cae_expires_at)}</p>
      </div>
    </section>

    <section class="section grid">
      <div>
        <h2>Receptor</h2>
        <p>${escapeHtml(document.receiver_name)}</p>
        <p>A CONSUMIDOR FINAL</p>
        <p>Documento: ${escapeHtml(document.receiver_doc_type)} ${escapeHtml(document.receiver_doc_number ?? "0")}</p>
      </div>
      <div>
        <h2>Origen interno</h2>
        <p>Venta de caja / remito</p>
        <p>Remito: ${escapeHtml(formatDocumentNumber(remito?.point_of_sale, remito?.document_number))}</p>
        <p class="muted">Este PDF se genera internamente desde Stock Sur.</p>
      </div>
    </section>

    <table>
      <thead>
        <tr>
          <th>Detalle</th>
          <th class="right">Cantidad</th>
          <th class="right">Precio unit.</th>
          <th class="right">IVA</th>
          <th class="right">Total</th>
        </tr>
      </thead>
      <tbody>${buildRows(lines)}</tbody>
    </table>

    <section class="totals">
      <div class="fiscal">
        ${qrDataUrl ? `<img class="qr" src="${escapeHtml(qrDataUrl)}" alt="QR fiscal ARCA" />` : `<div class="qr"></div>`}
        <div>
          <p class="muted">QR fiscal ARCA generado internamente.</p>
          <p class="muted">${escapeHtml(fiscalQrUrl)}</p>
        </div>
      </div>
      <div class="totals-box">
        <div class="total-row"><span>Subtotal</span><strong>${formatMoney(document.subtotal)}</strong></div>
        <div class="total-row"><span>IVA</span><strong>${formatMoney(document.tax_total)}</strong></div>
        <div class="total-row"><span>Descuento</span><strong>${formatMoney(document.discount_total)}</strong></div>
        <div class="total-row strong"><span>Total</span><span>${formatMoney(document.total)}</span></div>
      </div>
    </section>
  </main>
</body>
</html>`;
}
