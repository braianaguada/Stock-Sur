import type { ServiceDocumentLine, ServiceDocumentStatus } from "./types";

export const SERVICE_STATUS_LABEL: Record<ServiceDocumentStatus, string> = {
  DRAFT: "Borrador",
  SENT: "Enviado",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  CANCELLED: "Cancelado",
};

export const DEFAULT_SERVICE_TEXTS = {
  intro_text:
    "De acuerdo a lo solicitado, detallamos a continuacion nuestra propuesta de servicios.",
  closing_text:
    "Quedamos a disposicion para cualquier consulta o ajuste sobre esta propuesta.",
  delivery_time: "A coordinar segun disponibilidad operativa.",
  payment_terms: "50% de anticipo y saldo contra finalizacion del servicio.",
  delivery_location: "En instalaciones del cliente o lugar a coordinar.",
};

export const EMPTY_SERVICE_LINE: ServiceDocumentLine = {
  description: "",
  quantity: 1,
  unit: "serv",
  unit_price: 0,
  line_total: 0,
  sort_order: 1,
};
