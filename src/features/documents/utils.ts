import { formatDocumentNumber } from "@/lib/formatters";
import { STATUS_LABEL } from "./constants";
import type { DocEventRow, DocStatus, DocumentFormState, DocumentServiceOption, PriceListRow } from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const formatNumber = (n: number | null, pointOfSale: number) =>
  n === null ? "BORRADOR" : formatDocumentNumber(pointOfSale, n);

export const OCCASIONAL_CUSTOMER_DISPLAY_NAME = "Cliente ocasional / Consumidor Final";
export const OCCASIONAL_CUSTOMER_DEFAULT_NAME = "Cliente ocasional";

export type RecipientDisplay = {
  primaryName: string;
  secondaryName: string | null;
  fiscalLabel: string | null;
  isRegisteredCustomer: boolean;
  isOccasional: boolean;
  isInternal: boolean;
  isServiceLinked: boolean;
  technicianName: string | null;
};

export function resolveDocumentRecipient(
  document: {
    customer_id?: string | null;
    customer_name?: string | null;
    customer_kind?: string | null;
    service_id?: string | null;
    customers?: { name?: string | null } | null;
  },
  options: { technicianName?: string | null; internalReference?: string | null } = {},
): RecipientDisplay {
  const customerName = document.customer_name?.trim() || null;
  const technicianName = options.technicianName?.trim() || null;

  if (document.customer_kind === "INTERNO") {
    return {
      primaryName: technicianName || "Personal interno",
      secondaryName: options.internalReference?.trim() || customerName,
      fiscalLabel: null,
      isRegisteredCustomer: false,
      isOccasional: false,
      isInternal: true,
      isServiceLinked: Boolean(document.service_id),
      technicianName,
    };
  }

  if (document.customer_id) {
    return {
      primaryName: document.customers?.name?.trim() || customerName || "Cliente registrado",
      secondaryName: null,
      fiscalLabel: null,
      isRegisteredCustomer: true,
      isOccasional: false,
      isInternal: false,
      isServiceLinked: Boolean(document.service_id),
      technicianName,
    };
  }

  const normalizedName = customerName?.toLocaleLowerCase("es-AR");
  const isDefaultName = !normalizedName
    || normalizedName === OCCASIONAL_CUSTOMER_DEFAULT_NAME.toLocaleLowerCase("es-AR")
    || normalizedName === OCCASIONAL_CUSTOMER_DISPLAY_NAME.toLocaleLowerCase("es-AR");

  return {
    primaryName: OCCASIONAL_CUSTOMER_DISPLAY_NAME,
    secondaryName: isDefaultName ? null : customerName,
    fiscalLabel: "Consumidor Final",
    isRegisteredCustomer: false,
    isOccasional: true,
    isInternal: false,
    isServiceLinked: Boolean(document.service_id),
    technicianName,
  };
}

export function getCustomerDisplayName(entity: {
  customer_id?: string | null;
  customer_name?: string | null;
  customers?: { name?: string | null } | null;
}) {
  return resolveDocumentRecipient(entity).primaryName;
}

export function buildDocumentCustomerSnapshot(input: {
  customerId: string;
  manualCustomerName: string;
  pickedCustomer?: { id: string; name: string; cuit: string | null } | null;
  manualTaxId: string;
  manualTaxCondition: string;
}) {
  if (input.pickedCustomer) {
    return {
      customer_id: input.pickedCustomer.id,
      customer_name: input.pickedCustomer.name,
      customer_tax_id: input.pickedCustomer.cuit,
      customer_tax_condition: null,
    };
  }

  return {
    customer_id: null,
    customer_name: input.manualCustomerName.trim() || OCCASIONAL_CUSTOMER_DEFAULT_NAME,
    customer_tax_id: null,
    customer_tax_condition: null,
  };
}

export function validateDocumentRecipientDraft(
  draft: DocumentFormState,
  serviceOptions: DocumentServiceOption[],
) {
  if (draft.customer_kind === "INTERNO") {
    if (draft.doc_type !== "REMITO") throw new Error("El remito interno solo aplica a remitos");
    if (!draft.technician_id) throw new Error("El remito interno requiere tecnico");
    if (!draft.internal_remito_type) throw new Error("El remito interno requiere tipo de imputacion");
    if (draft.customer_id || draft.payment_terms || draft.service_id) {
      throw new Error("El remito interno no puede conservar cliente, condicion de venta ni servicio");
    }
    return;
  }

  if (draft.recipient_type === "REGISTERED" && !draft.customer_id) {
    throw new Error("Cliente registrado requiere seleccionar un cliente");
  }

  if (draft.recipient_type === "OCCASIONAL" && draft.technician_id) {
    throw new Error("Cliente ocasional no puede tener tecnico asociado");
  }

  if (draft.customer_kind === "EMPRESA" && !draft.customer_id) {
    throw new Error("Empresa requiere seleccionar un cliente registrado");
  }

  if (draft.service_id) {
    const service = serviceOptions.find((option) => option.id === draft.service_id);
    if (!service) throw new Error("El servicio asociado no esta disponible");
    if (service.customerId !== draft.customer_id) {
      throw new Error("El cliente del remito debe coincidir con el cliente del servicio");
    }
  }
}

function applyPriceListRounding(value: number, roundMode: PriceListRow["round_mode"], roundTo: number | null) {
  switch (roundMode) {
    case "integer":
      return Math.round(value);
    case "tens":
      return Math.round(value / 10) * 10;
    case "hundreds":
      return Math.round(value / 100) * 100;
    case "x99":
      return value <= 0 ? 0 : Math.floor(value) + 0.99;
    case "none":
    default: {
      const safeRoundTo = !roundTo || roundTo <= 0 ? 1 : roundTo;
      if (safeRoundTo === 1) return value;
      return Math.round(value / safeRoundTo) * safeRoundTo;
    }
  }
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculatePriceFromCostBase(
  baseCost: number,
  fletePct: number | null,
  marginPct: number | null,
  ivaPct: number | null,
) {
  const fleteMultiplier = 1 + (Number(fletePct) || 0) / 100;
  const marginMultiplier = 1 + (Number(marginPct) || 0) / 100;
  const ivaMultiplier = 1 + (Number(ivaPct) || 0) / 100;
  return roundMoney(baseCost * fleteMultiplier * marginMultiplier * ivaMultiplier);
}

export function describeDocumentHistoryEvent(event: DocEventRow) {
  const payload = isRecord(event.payload) ? event.payload : null;

  switch (event.event_type) {
    case "EXTERNAL_INVOICE_SET": {
      const number = typeof payload?.external_invoice_number === "string" ? payload.external_invoice_number : null;
      return {
        title: "Factura externa registrada",
        detail: number ? `Se asocio la factura ${number}` : "Se registro una factura externa",
        tone: "info" as const,
      };
    }
    case "EXTERNAL_INVOICE_CLEARED":
      return {
        title: "Factura externa quitada",
        detail: "Se desvinculo la referencia fiscal externa",
        tone: "warning" as const,
      };
    case "CREATED": {
      const source = typeof payload?.source === "string" ? payload.source : null;
      const sourceNumber = typeof payload?.source_number === "string" ? payload.source_number : null;
      const sourceDocType = typeof payload?.source_doc_type === "string" ? payload.source_doc_type : null;
      return {
        title: source === "budget_conversion" ? "Remito creado" : "Documento creado",
        detail:
          source === "budget_conversion"
            ? `Creado a partir de ${sourceDocType === "PRESUPUESTO" ? "presupuesto" : "documento"} ${sourceNumber ?? ""}`.trim()
            : "Borrador inicial",
        tone: "neutral" as const,
      };
    }
    case "UPDATED":
      return {
        title: "Borrador actualizado",
        detail: "Se guardaron cambios",
        tone: "info" as const,
      };
    case "DUPLICATED_FROM_DOCUMENT": {
      const sourceNumber = typeof payload?.source_number === "string" ? payload.source_number : null;
      const sourceDocType = typeof payload?.source_doc_type === "string" ? payload.source_doc_type : null;
      return {
        title: "Documento duplicado",
        detail: sourceNumber
          ? `Creado desde ${sourceDocType === "REMITO" ? "remito" : "presupuesto"} ${sourceNumber}`
          : "Creado desde otro documento",
        tone: "info" as const,
      };
    }
    case "STATUS_CHANGED": {
      const from = typeof payload?.from === "string" ? payload.from : null;
      const to = typeof payload?.to === "string" ? payload.to : null;
      const fromLabel = from && from in STATUS_LABEL ? STATUS_LABEL[from as DocStatus] : from;
      const toLabel = to && to in STATUS_LABEL ? STATUS_LABEL[to as DocStatus] : to;
      const tone =
        to === "APROBADO" || to === "EMITIDO"
          ? "success"
          : to === "RECHAZADO"
            ? "warning"
            : to === "ANULADO"
              ? "danger"
              : "info";
      return {
        title: "Cambio de estado",
        detail: fromLabel && toLabel ? `${fromLabel} -> ${toLabel}` : "Estado actualizado",
        tone,
      };
    }
    case "REMITO_EMITIDO": {
      const reference = typeof payload?.reference === "string" ? payload.reference : null;
      return {
        title: "Remito emitido",
        detail: reference ? `Stock descontado - ${reference}` : "Stock descontado automaticamente",
        tone: "success" as const,
      };
    }
    case "REMIO_CREATED_FROM_BUDGET":
    case "REMITO_CREATED_FROM_BUDGET": {
      const targetNumber = typeof payload?.target_number === "string" ? payload.target_number : null;
      const sourceNumber = typeof payload?.source_number === "string" ? payload.source_number : null;
      return {
        title: "Convertido a remito",
        detail:
          targetNumber && sourceNumber
            ? `Remito ${targetNumber} creado desde Presupuesto ${sourceNumber}`
            : targetNumber
              ? `Nuevo remito ${targetNumber}`
              : "Nuevo remito borrador",
        tone: "info" as const,
      };
    }
    default:
      return {
        title: event.event_type.replaceAll("_", " "),
        detail: "Movimiento registrado",
        tone: "neutral" as const,
      };
  }
}
