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
  estimatedValue: number;
  externalInvoiceNumber: string | null;
  originDocumentId: string | null;
  documentUrl: string;
  serviceUrl: string | null;
};

export type TechnicianMaterialSummary = {
  technicianId: string;
  technicianName: string;
  remitos: number;
  devoluciones: number;
  clients: number;
  jobs: number;
  deliveredValue: number;
  returnedValue: number;
  materialBalance: number;
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
};

export type MaterialControlReport = {
  movements: MaterialControlMovement[];
  technicianSummaries: TechnicianMaterialSummary[];
  materialRowsByTechnician: Map<string, MaterialSummaryRow[]>;
  totals: {
    deliveredValue: number;
    returnedValue: number;
    materialBalance: number;
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

export function getDocumentControlUrl(documentId: string) {
  return `/documents?document_id=${documentId}`;
}

export function getServiceControlUrl(serviceId: string | null) {
  return serviceId ? `/service-jobs?serviceId=${serviceId}` : null;
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
      const lineTotal = documentLines.reduce((sum, line) => sum + estimateLineValue(line), 0);
      const estimatedValue = Number(document.total) || lineTotal;
      const documentLabel = formatDocumentNumber(document.point_of_sale, document.document_number);

      return {
        id: document.id,
        date: document.issue_date,
        technicianId: document.technician_id ?? "",
        technicianName: technician?.name ?? "Tecnico sin nombre",
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
        estimatedValue,
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
      remitos: 0,
      devoluciones: 0,
      clients: 0,
      jobs: 0,
      deliveredValue: 0,
      returnedValue: 0,
      materialBalance: 0,
      movements: [],
    };

    summary.movements.push(movement);
    if (movement.documentType === "REMITO") {
      summary.remitos += 1;
      summary.deliveredValue += movement.estimatedValue;
    } else {
      summary.devoluciones += 1;
      summary.returnedValue += movement.estimatedValue;
    }
    summary.materialBalance = summary.deliveredValue - summary.returnedValue;
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
      };
      const quantity = Number(line.quantity) || 0;
      const value = estimateLineValue(line);
      if (movement.documentType === "REMITO") {
        row.deliveredQuantity += quantity;
        row.deliveredValue += value;
      } else {
        row.returnedQuantity += quantity;
        row.returnedValue += value;
      }
      row.netQuantity = row.deliveredQuantity - row.returnedQuantity;
      row.netValue = row.deliveredValue - row.returnedValue;
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
  const deliveredValue = activeMovements
    .filter((movement) => movement.documentType === "REMITO")
    .reduce((sum, movement) => sum + movement.estimatedValue, 0);
  const returnedValue = activeMovements
    .filter((movement) => movement.documentType === "REMITO_DEVOLUCION")
    .reduce((sum, movement) => sum + movement.estimatedValue, 0);

  return {
    movements,
    technicianSummaries,
    materialRowsByTechnician,
    totals: {
      deliveredValue,
      returnedValue,
      materialBalance: deliveredValue - returnedValue,
      remitos: activeMovements.filter((movement) => movement.documentType === "REMITO").length,
      devoluciones: activeMovements.filter((movement) => movement.documentType === "REMITO_DEVOLUCION").length,
      clients: new Set(activeMovements.map((movement) => movement.customerId ?? movement.customerName).filter(Boolean)).size,
      jobs: new Set(activeMovements.map((movement) => movement.jobId ?? movement.serviceId).filter(Boolean)).size,
    },
  };
}
