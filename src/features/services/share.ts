import { formatMoney } from "@/lib/formatters";
import { getPublicAppOrigin } from "@/lib/public-app-url";
import type { ServiceDocument } from "./types";

export function buildPublicServiceDocumentUrl(token: string) {
  return `${getPublicAppOrigin()}/public/service-document/${encodeURIComponent(token)}`;
}

export function normalizeWhatsAppNumber(input: string) {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("549")) return digits;
  if (digits.startsWith("54")) return digits;
  if (digits.startsWith("0")) return `54${digits.slice(1).replace(/^15/, "9")}`;
  if (digits.length >= 8 && digits.length <= 11) return `54${digits.replace(/^15/, "9")}`;
  return digits;
}

export function buildServiceDocumentShareMessage(document: ServiceDocument, publicLink: string) {
  const number = `SERV-${String(document.number).padStart(6, "0")}`;
  if (document.currency === "USD") {
    const rate = Number(document.exchange_rate ?? 0);
    const arsTotal = rate > 0 ? Number(document.total ?? 0) * rate : null;
    return [
      `Hola, te compartimos el presupuesto de servicio N° ${number}.`,
      "",
      `Total: ${formatMoney(document.total, "USD")}`,
      rate > 0 ? `Cotizacion Banco Nacion: 1 USD = ${formatMoney(rate, "ARS")}` : null,
      arsTotal != null ? `Equivalente estimado: ${formatMoney(arsTotal, "ARS")}` : null,
      "",
      "Podes verlo y descargar el PDF aca:",
      publicLink,
    ].filter(Boolean).join("\n");
  }

  return [
    `Hola, te compartimos el presupuesto de servicio N° ${number}.`,
    "",
    `Total: ${formatMoney(document.total, "ARS")}`,
    "",
    "Podes verlo y descargar el PDF aca:",
    publicLink,
  ].join("\n");
}

export function buildWhatsAppUrl(params: { phone: string; message: string }) {
  const normalized = normalizeWhatsAppNumber(params.phone);
  const encoded = encodeURIComponent(params.message);
  return normalized ? `https://wa.me/${normalized}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

export function buildMailtoUrl(params: { email: string; subject: string; body: string }) {
  const recipient = params.email.trim();
  const subject = encodeURIComponent(params.subject);
  const body = encodeURIComponent(params.body);
  return `mailto:${encodeURIComponent(recipient)}?subject=${subject}&body=${body}`;
}
