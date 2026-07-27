import { getPublicAppOrigin } from "@/lib/public-app-url";
import type { DocRow } from "./types";
import { formatNumber } from "./utils";

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
