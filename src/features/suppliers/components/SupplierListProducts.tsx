import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { MoneyCell, PrimaryCell } from "@/components/common/VisualSystem";
import { RowActionButton, RowActions } from "@/components/common/RowActions";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePaginationSlice } from "@/hooks/use-pagination-slice";
import { supplierMoney, supplierPriceBreakdown, type DisplayCurrency } from "../pricing";
import type { CatalogLine, Supplier } from "../types";

export function SupplierListProducts({ lines, supplier, currency, rate, loading, compact, onAdd }: {
  lines: CatalogLine[]; supplier: Supplier; currency: DisplayCurrency; rate?: number; loading?: boolean; compact?: boolean;
  onAdd: (line: CatalogLine, quantity: number) => void;
}) {
  const [page, setPage] = useState(1);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const pagination = usePaginationSlice({ items: lines, page, pageSize: compact ? 10 : 25 });
  const columns: ColumnDef<CatalogLine, unknown>[] = [
    { id: "name", header: "Producto / unidad", cell: ({ row }) => <PrimaryCell title={row.original.product_name || row.original.raw_description} metadata={`${row.original.presentation_raw || "unidad"} · Original ${supplierMoney(Number(row.original.cost), row.original.currency)}${row.original.tax_treatment === "UNKNOWN" ? " · IVA no informado: volver a importar" : ""}`} /> },
    ...(["net", "vat", "freight", "total"] as const).map((field): ColumnDef<CatalogLine, unknown> => ({
      id: field, header: ({ net: "Sin IVA", vat: `IVA ${supplier.vat_rate ?? 21}%`, freight: `Flete ${supplier.freight_rate ?? 0}%`, total: "Total" })[field],
      cell: ({ row }) => <MoneyCell value={supplierMoney(supplierPriceBreakdown(row.original, supplier, currency, rate)?.[field], currency)} format="plain" />,
    })),
    { id: "quantity", header: "Cant.", cell: ({ row }) => <Input className="w-20" aria-label={`Cantidad de ${row.original.raw_description}`} type="number" min={1} step={1} value={quantities[row.original.id] ?? 1} onChange={(event) => setQuantities((current) => ({ ...current, [row.original.id]: Math.max(1, Math.trunc(Number(event.target.value) || 1)) }))} /> },
    { id: "add", header: "", cell: ({ row }) => <RowActions><RowActionButton label="Agregar al carrito" disabled={!supplier.is_active || !supplierPriceBreakdown(row.original, supplier, currency, rate)} onClick={() => onAdd(row.original, quantities[row.original.id] ?? 1)}><Plus className="h-4 w-4" /></RowActionButton></RowActions> },
  ];
  // Side-by-side comparison stacks the amounts to keep each supplier readable on narrow screens.
  const visibleColumns = compact ? columns.filter((column) => !["net", "vat", "freight"].includes(column.id ?? "")).map((column) => column.id === "total" ? {
    ...column, header: "Precio y cargos", cell: ({ row }: { row: { original: CatalogLine } }) => {
      const price = supplierPriceBreakdown(row.original, supplier, currency, rate);
      return <div className="space-y-1 text-xs"><div>Neto <MoneyCell value={supplierMoney(price?.net, currency)} format="plain" /></div><div>IVA {supplier.vat_rate ?? 21}% · {supplierMoney(price?.vat, currency)}</div><div>Flete {supplier.freight_rate ?? 0}% · {supplierMoney(price?.freight, currency)}</div><MoneyCell value={supplierMoney(price?.total, currency)} format="plain" /></div>;
    },
  } : column) : columns;
  return <div className="min-w-0"><DataTable columns={visibleColumns} data={pagination.pagedItems} isLoading={loading} density="compact" getRowId={(line) => line.id} emptyMessage="No hay productos para esta búsqueda." /><DataTablePagination {...pagination} onPageChange={setPage} itemLabel="productos" /></div>;
}
