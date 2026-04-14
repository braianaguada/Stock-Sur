import type {
  CatalogLine,
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
  const rows = orderLines.map((line) =>
    `${line.supplier_code ?? "S/COD"} - ${line.raw_description} x ${line.quantity} - ${line.currency} ${line.cost.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
  );

  return [
    `Proveedor: ${selectedSupplier.name}`,
    `Listado/Version usada: ${catalogName} (${versionDate})`,
    "Items:",
    ...rows,
  ].join("\n");
}

export function groupSupplierVersionsByCatalog(catalogVersions: SupplierCatalogVersion[]) {
  return catalogVersions.reduce<Record<string, SupplierCatalogVersion[]>>((grouped, version) => {
    if (!grouped[version.catalog_id]) grouped[version.catalog_id] = [];
    grouped[version.catalog_id].push(version);
    return grouped;
  }, {});
}

export function addCatalogLineToOrder(
  orderItems: Record<string, OrderLine>,
  lineQuantities: Record<string, number>,
  line: CatalogLine,
) {
  const quantityToAdd = Math.max(1, Math.trunc(lineQuantities[line.id] ?? 1));
  const current = orderItems[line.id];
  const quantity = current ? current.quantity + quantityToAdd : quantityToAdd;

  return {
    ...orderItems,
    [line.id]: { ...line, quantity },
  };
}

export function normalizeSupplierQuantityInput(value: string) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity)) return null;
  return Math.max(1, Math.trunc(quantity));
}

export function updateOrderItemQuantity(
  orderItems: Record<string, OrderLine>,
  lineId: string,
  quantity: number,
) {
  if (!orderItems[lineId]) return orderItems;

  return {
    ...orderItems,
    [lineId]: { ...orderItems[lineId], quantity },
  };
}

export function removeOrderItemFromState(orderItems: Record<string, OrderLine>, lineId: string) {
  const { [lineId]: _, ...rest } = orderItems;
  return rest;
}
