import { formatDocumentNumber } from "@/lib/formatters";

export type MaterialControlDocType = "REMITO" | "REMITO_DEVOLUCION";

export type MaterialControlDocument = {
  id: string;
  doc_type: MaterialControlDocType;
  status: string;
  point_of_sale: number;
  document_number: number | null;
  issue_date: string;
  technician_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  service_id: string | null;
  origin_document_id: string | null;
  source_document_id: string | null;
  source_document_number_snapshot: string | null;
  external_invoice_number: string | null;
  total: number;
  created_at: string;
};

export type MaterialControlLine = {
  id: string;
  document_id: string;
  item_id: string | null;
  description: string;
  sku_snapshot: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  base_cost_snapshot: number | null;
};

export type MaterialControlTechnician = {
  id: string;
  name: string;
  phone?: string | null;
  is_active?: boolean;
};

export type MaterialControlService = {
  id: string;
  title: string;
  job_id: string;
  jobTitle: string;
  customerName: string | null;
};

export type MaterialControlMovement = {
  id: string;
  date: string;
  technicianId: string;
  technicianName: string;
  technicianIsActive: boolean | null;
  technicianMissing: boolean;
  documentId: string;
  documentLabel: string;
  documentType: MaterialControlDocType;
  movementType: "Entrega" | "Devolucion";
  customerId: string | null;
  customerName: string;
  serviceId: string | null;
  serviceLabel: string | null;
  jobId: string | null;
  jobLabel: string | null;
  items: number;
  materialValue: number;
  commercialTotal: number;
  estimatedCost: number;
  grossMargin: number;
  externalInvoiceNumber: string | null;
  originDocumentId: string | null;
  documentUrl: string;
  serviceUrl: string | null;
};

export type TechnicianMaterialSummary = {
  technicianId: string;
  technicianName: string;
  technicianIsActive: boolean | null;
  technicianMissing: boolean;
  remitos: number;
  devoluciones: number;
  clients: number;
  jobs: number;
  materialDeliveredValue: number;
  materialReturnedValue: number;
  materialBalance: number;
  commercialDeliveredTotal: number;
  commercialReturnedTotal: number;
  commercialBalance: number;
  costDeliveredValue: number;
  costReturnedValue: number;
  costNetValue: number;
  grossMargin: number;
  movements: MaterialControlMovement[];
};

export type MaterialSummaryRow = {
  key: string;
  product: string;
  sku: string | null;
  deliveredQuantity: number;
  returnedQuantity: number;
  netQuantity: number;
  deliveredValue: number;
  returnedValue: number;
  netValue: number;
  deliveredCost: number;
  returnedCost: number;
  netCost: number;
  grossMargin: number;
};

export type MaterialControlReport = {
  movements: MaterialControlMovement[];
  technicianSummaries: TechnicianMaterialSummary[];
  materialRowsByTechnician: Map<string, MaterialSummaryRow[]>;
  totals: {
    materialDeliveredValue: number;
    materialReturnedValue: number;
    materialBalance: number;
    commercialDeliveredTotal: number;
    commercialReturnedTotal: number;
    commercialBalance: number;
    commercialPeriodTotal: number;
    costDeliveredValue: number;
    costReturnedValue: number;
    costNetValue: number;
    grossMargin: number;
    remitos: number;
    devoluciones: number;
    clients: number;
    jobs: number;
  };
};

export type MaterialControlFilters = {
  technicianId: string;
  customerId: string;
  serviceId: string;
  type: "ALL" | MaterialControlDocType;
  search: string;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function estimateLineValue(line: MaterialControlLine) {
  const lineTotal = Number(line.line_total) || 0;
  if (lineTotal > 0) return lineTotal;
  return (Number(line.quantity) || 0) * (Number(line.unit_price) || 0);
}

function estimateLineCost(line: MaterialControlLine) {
  const baseCost = Number(line.base_cost_snapshot) || 0;
  return (Number(line.quantity) || 0) * baseCost;
}

export function getDocumentControlUrl(documentId: string) {
  return `/documents?document_id=${documentId}`;
}

export function getServiceControlUrl(serviceId: string | null) {
  return serviceId ? `/service-jobs?serviceId=${serviceId}` : null;
}

export function getDeletedTechnicianLabel(technicianId: string) {
  return technicianId ? `Tecnico eliminado (${technicianId.slice(0, 8)})` : "Tecnico eliminado";
}

export function buildMaterialControlReport(params: {
  documents: MaterialControlDocument[];
  lines: MaterialControlLine[];
  technicians: MaterialControlTechnician[];
  services: MaterialControlService[];
  filters: MaterialControlFilters;
}): MaterialControlReport {
  const techniciansById = new Map(params.technicians.map((technician) => [technician.id, technician]));
  const servicesById = new Map(params.services.map((service) => [service.id, service]));
  const linesByDocument = new Map<string, MaterialControlLine[]>();
  for (const line of params.lines) {
    linesByDocument.set(line.document_id, [...(linesByDocument.get(line.document_id) ?? []), line]);
  }

  const query = normalize(params.filters.search.trim());
  const movements = params.documents
    .filter((document) => document.technician_id)
    .filter((document) => document.status !== "ANULADO")
    .filter((document) => params.filters.technicianId === "ALL" || document.technician_id === params.filters.technicianId)
    .filter((document) => params.filters.customerId === "ALL" || document.customer_id === params.filters.customerId)
    .filter((document) => params.filters.serviceId === "ALL" || document.service_id === params.filters.serviceId)
    .filter((document) => params.filters.type === "ALL" || document.doc_type === params.filters.type)
    .map<MaterialControlMovement>((document) => {
      const technician = techniciansById.get(document.technician_id ?? "");
      const service = document.service_id ? servicesById.get(document.service_id) ?? null : null;
      const documentLines = linesByDocument.get(document.id) ?? [];
      const materialValue = documentLines.reduce((sum, line) => sum + estimateLineValue(line), 0);
      const commercialTotal = Number(document.total) || 0;
      const estimatedCost = documentLines.reduce((sum, line) => sum + estimateLineCost(line), 0);
      const documentLabel = formatDocumentNumber(document.point_of_sale, document.document_number);

      return {
        id: document.id,
        date: document.issue_date,
        technicianId: document.technician_id ?? "",
        technicianName: technician?.name?.trim() || getDeletedTechnicianLabel(document.technician_id ?? ""),
        technicianIsActive: technician ? technician.is_active ?? true : null,
        technicianMissing: !technician,
        documentId: document.id,
        documentLabel,
        documentType: document.doc_type,
        movementType: document.doc_type === "REMITO_DEVOLUCION" ? "Devolucion" : "Entrega",
        customerId: document.customer_id,
        customerName: document.customer_name ?? service?.customerName ?? "Sin cliente",
        serviceId: document.service_id,
        serviceLabel: service?.title ?? null,
        jobId: service?.job_id ?? null,
        jobLabel: service?.jobTitle ?? null,
        items: documentLines.length,
        materialValue,
        commercialTotal,
        estimatedCost,
        grossMargin: commercialTotal - estimatedCost,
        externalInvoiceNumber: document.external_invoice_number,
        originDocumentId: document.origin_document_id ?? document.source_document_id,
        documentUrl: getDocumentControlUrl(document.id),
        serviceUrl: getServiceControlUrl(document.service_id),
      };
    })
    .filter((movement) => {
      if (!query) return true;
      const materialText = (linesByDocument.get(movement.documentId) ?? [])
        .map((line) => [line.description, line.sku_snapshot].filter(Boolean).join(" "))
        .join(" ");
      return normalize([
        movement.documentLabel,
        movement.externalInvoiceNumber,
        movement.customerName,
        movement.technicianName,
        movement.serviceLabel,
        movement.jobLabel,
        materialText,
      ].filter(Boolean).join(" ")).includes(query);
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.documentLabel.localeCompare(a.documentLabel));

  const summaryMap = new Map<string, TechnicianMaterialSummary>();
  const materialMapByTechnician = new Map<string, Map<string, MaterialSummaryRow>>();
  const movementIds = new Set(movements.map((movement) => movement.id));

  for (const movement of movements) {
    const summary = summaryMap.get(movement.technicianId) ?? {
      technicianId: movement.technicianId,
      technicianName: movement.technicianName,
      technicianIsActive: movement.technicianIsActive,
      technicianMissing: movement.technicianMissing,
      remitos: 0,
      devoluciones: 0,
      clients: 0,
      jobs: 0,
      materialDeliveredValue: 0,
      materialReturnedValue: 0,
      materialBalance: 0,
      commercialDeliveredTotal: 0,
      commercialReturnedTotal: 0,
      commercialBalance: 0,
      costDeliveredValue: 0,
      costReturnedValue: 0,
      costNetValue: 0,
      grossMargin: 0,
      movements: [],
    };

    summary.movements.push(movement);
    if (movement.documentType === "REMITO") {
      summary.remitos += 1;
      summary.materialDeliveredValue += movement.materialValue;
      summary.commercialDeliveredTotal += movement.commercialTotal;
      summary.costDeliveredValue += movement.estimatedCost;
    } else {
      summary.devoluciones += 1;
      summary.materialReturnedValue += movement.materialValue;
      summary.commercialReturnedTotal += movement.commercialTotal;
      summary.costReturnedValue += movement.estimatedCost;
    }
    summary.materialBalance = summary.materialDeliveredValue - summary.materialReturnedValue;
    summary.commercialBalance = summary.commercialDeliveredTotal - summary.commercialReturnedTotal;
    summary.costNetValue = summary.costDeliveredValue - summary.costReturnedValue;
    summary.grossMargin = summary.commercialBalance - summary.costNetValue;
    summaryMap.set(movement.technicianId, summary);

    const currentMaterialMap = materialMapByTechnician.get(movement.technicianId) ?? new Map<string, MaterialSummaryRow>();
    for (const line of linesByDocument.get(movement.documentId) ?? []) {
      const key = line.item_id ?? `${line.sku_snapshot ?? ""}:${line.description}`;
      const row = currentMaterialMap.get(key) ?? {
        key,
        product: line.description,
        sku: line.sku_snapshot,
        deliveredQuantity: 0,
        returnedQuantity: 0,
        netQuantity: 0,
        deliveredValue: 0,
        returnedValue: 0,
        netValue: 0,
        deliveredCost: 0,
        returnedCost: 0,
        netCost: 0,
        grossMargin: 0,
      };
      const quantity = Number(line.quantity) || 0;
      const value = estimateLineValue(line);
      const cost = estimateLineCost(line);
      if (movement.documentType === "REMITO") {
        row.deliveredQuantity += quantity;
        row.deliveredValue += value;
        row.deliveredCost += cost;
      } else {
        row.returnedQuantity += quantity;
        row.returnedValue += value;
        row.returnedCost += cost;
      }
      row.netQuantity = row.deliveredQuantity - row.returnedQuantity;
      row.netValue = row.deliveredValue - row.returnedValue;
      row.netCost = row.deliveredCost - row.returnedCost;
      row.grossMargin = row.netValue - row.netCost;
      currentMaterialMap.set(key, row);
    }
    materialMapByTechnician.set(movement.technicianId, currentMaterialMap);
  }

  for (const summary of summaryMap.values()) {
    summary.clients = new Set(summary.movements.map((movement) => movement.customerId ?? movement.customerName).filter(Boolean)).size;
    summary.jobs = new Set(summary.movements.map((movement) => movement.jobId ?? movement.serviceId).filter(Boolean)).size;
  }

  const technicianSummaries = Array.from(summaryMap.values()).sort((a, b) => b.materialBalance - a.materialBalance);
  const materialRowsByTechnician = new Map<string, MaterialSummaryRow[]>();
  for (const [technicianId, materialMap] of materialMapByTechnician.entries()) {
    materialRowsByTechnician.set(
      technicianId,
      Array.from(materialMap.values()).sort((a, b) => b.netValue - a.netValue),
    );
  }

  const activeMovements = movements.filter((movement) => movementIds.has(movement.id));
  const materialDeliveredValue = activeMovements
    .filter((movement) => movement.documentType === "REMITO")
    .reduce((sum, movement) => sum + movement.materialValue, 0);
  const materialReturnedValue = activeMovements
    .filter((movement) => movement.documentType === "REMITO_DEVOLUCION")
    .reduce((sum, movement) => sum + movement.materialValue, 0);
  const commercialDeliveredTotal = activeMovements
    .filter((movement) => movement.documentType === "REMITO")
    .reduce((sum, movement) => sum + movement.commercialTotal, 0);
  const commercialReturnedTotal = activeMovements
    .filter((movement) => movement.documentType === "REMITO_DEVOLUCION")
    .reduce((sum, movement) => sum + movement.commercialTotal, 0);
  const costDeliveredValue = activeMovements
    .filter((movement) => movement.documentType === "REMITO")
    .reduce((sum, movement) => sum + movement.estimatedCost, 0);
  const costReturnedValue = activeMovements
    .filter((movement) => movement.documentType === "REMITO_DEVOLUCION")
    .reduce((sum, movement) => sum + movement.estimatedCost, 0);
  const commercialBalance = commercialDeliveredTotal - commercialReturnedTotal;
  const costNetValue = costDeliveredValue - costReturnedValue;

  return {
    movements,
    technicianSummaries,
    materialRowsByTechnician,
    totals: {
      materialDeliveredValue,
      materialReturnedValue,
      materialBalance: materialDeliveredValue - materialReturnedValue,
      commercialDeliveredTotal,
      commercialReturnedTotal,
      commercialBalance,
      commercialPeriodTotal: commercialDeliveredTotal + commercialReturnedTotal,
      costDeliveredValue,
      costReturnedValue,
      costNetValue,
      grossMargin: commercialBalance - costNetValue,
      remitos: activeMovements.filter((movement) => movement.documentType === "REMITO").length,
      devoluciones: activeMovements.filter((movement) => movement.documentType === "REMITO_DEVOLUCION").length,
      clients: new Set(activeMovements.map((movement) => movement.customerId ?? movement.customerName).filter(Boolean)).size,
      jobs: new Set(activeMovements.map((movement) => movement.jobId ?? movement.serviceId).filter(Boolean)).size,
    },
  };
}
