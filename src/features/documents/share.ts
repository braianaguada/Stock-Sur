import type { DocRow } from "./types";
import { formatNumber } from "./utils";

function getPublicAppOrigin() {
  const buildOrigin = typeof __PUBLIC_APP_URL__ === "string" ? __PUBLIC_APP_URL__ : "";
  const configuredOrigin = buildOrigin || import.meta.env.VITE_PUBLIC_APP_URL?.trim();
  if (configuredOrigin) return configuredOrigin.replace(/\/+$/, "");
  return window.location.origin;
}

export function buildPublicDocumentUrl(token: string) {
  return `${getPublicAppOrigin()}/public/document/${encodeURIComponent(token)}`;
}

export function buildDocumentShareMessage(document: DocRow, publicLink: string) {
  const label = document.doc_type === "PRESUPUESTO" ? "presupuesto" : "remito";
  return [
    `Hola, te compartimos el ${label} N° ${formatNumber(document.document_number, document.point_of_sale)}.`,
    "",
    `Total: $${Number(document.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`,
    "",
    "Podés verlo y descargar el PDF acá:",
    publicLink,
  ].join("\n");
}
