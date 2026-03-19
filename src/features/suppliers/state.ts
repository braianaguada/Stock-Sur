import type {
  NormalizeDiagnostics,
  OrderLine,
  ParsePdfProgress,
  Supplier,
  SupplierCatalogVersion,
  SupplierFormState,
} from "@/features/suppliers/types";
import { formatSupplierDate } from "@/features/suppliers/utils";

export function createEmptySupplierForm(): SupplierFormState {
  return { name: "", contact_name: "", email: "", whatsapp: "", notes: "" };
}

export function buildSupplierFormState(supplier: Supplier): SupplierFormState {
  return {
    name: supplier.name,
    contact_name: supplier.contact_name ?? "",
    email: supplier.email ?? "",
    whatsapp: supplier.whatsapp ?? supplier.phone ?? "",
    notes: supplier.notes ?? "",
  };
}

export function createCatalogDialogState() {
  return {
    catalogSearch: "",
    activeVersionId: null as string | null,
    orderItems: {} as Record<string, OrderLine>,
    lineQuantities: {} as Record<string, number>,
    lastDiagnostics: null as NormalizeDiagnostics | null,
    pdfProgress: null as ParsePdfProgress | null,
    selectedCatalogId: "new",
    selectedFile: null as File | null,
    catalogUiTab: "catalogo" as const,
  };
}

export function buildSupplierOrderMessage(params: {
  selectedSupplier: Supplier | null;
  orderLines: OrderLine[];
  activeVersion: SupplierCatalogVersion | null;
  catalogTitleById: Map<string, string>;
}) {
  const { selectedSupplier, orderLines, activeVersion, catalogTitleById } = params;
  if (!selectedSupplier || orderLines.length === 0) return "";

  const versionDate = activeVersion ? formatSupplierDate(activeVersion.imported_at) : "Sin version";
  const catalogName = activeVersion
    ? catalogTitleById.get(activeVersion.catalog_id) ?? activeVersion.title ?? "Listado"
    : "Sin listado";
  const rows = orderLines.map((line) => `${line.supplier_code ?? "S/COD"} - ${line.raw_description} x ${line.quantity}`);

  return [
    `Proveedor: ${selectedSupplier.name}`,
    `Listado/Version usada: ${catalogName} (${versionDate})`,
    "Items:",
    ...rows,
  ].join("\n");
}
