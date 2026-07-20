import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { RowActionButton, RowActions } from "@/components/common/RowActions";
import { CategoryBadge, PrimaryCell } from "@/components/common/VisualSystem";
import { DataTable } from "@/components/data-table/DataTable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SupplierOfferPrice } from "@/features/suppliers/components/SupplierOfferPrice";
import type { CatalogLine } from "@/features/suppliers/types";

export function SupplierCatalogLinesTable({ lines, activeVersionId, isLoading, quantities, onQuantityChange, onAdd }: {
  lines: CatalogLine[];
  activeVersionId: string | null;
  isLoading: boolean;
  quantities: Record<string, number>;
  onQuantityChange: (lineId: string, value: string) => void;
  onAdd: (line: CatalogLine) => void;
}) {
  const columns = useMemo<ColumnDef<CatalogLine, unknown>[]>(() => [
    {
      id: "product",
      header: "Producto",
      cell: ({ row }) => (
        <PrimaryCell
          title={row.original.product_name ?? row.original.raw_description}
          metadata={[row.original.presentation_raw, row.original.additional_description, row.original.supplier_code ? `Cód. ${row.original.supplier_code}` : null].filter(Boolean).join(" · ")}
        />
      ),
    },
    {
      id: "price",
      header: "Precio",
      cell: ({ row }) => {
        const taxLabel = row.original.tax_treatment === "INCLUDED"
          ? "IVA incluido"
          : row.original.tax_treatment === "EXCLUDED" ? "Más IVA" : "IVA no informado";
        return (
          <div className="space-y-1 text-right">
            <SupplierOfferPrice value={Number(row.original.cost)} currency={row.original.currency} />
            <CategoryBadge>{taxLabel}</CategoryBadge>
          </div>
        );
      },
      meta: { className: "w-[150px]" },
    },
    {
      id: "quantity",
      header: "Cantidad",
      cell: ({ row }) => (
        <div className="w-24">
          <Label htmlFor={`catalog-quantity-${row.original.id}`} className="sr-only">Cantidad</Label>
          <Input
            id={`catalog-quantity-${row.original.id}`}
            type="number"
            min={1}
            step={1}
            value={quantities[row.original.id] ?? 1}
            onChange={(event) => onQuantityChange(row.original.id, event.target.value)}
          />
        </div>
      ),
      meta: { className: "w-[120px]" },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Acciones</div>,
      cell: ({ row }) => (
        <RowActions>
          <RowActionButton label="Agregar al pedido" tone="success" onClick={() => onAdd(row.original)}>
            <Plus className="h-4 w-4" />
          </RowActionButton>
        </RowActions>
      ),
      meta: { className: "w-[90px]" },
    },
  ], [onAdd, onQuantityChange, quantities]);

  return (
    <DataTable
      columns={columns}
      data={lines}
      density="compact"
      isLoading={Boolean(activeVersionId && isLoading)}
      emptyMessage={activeVersionId ? "No encontramos productos. Probá con otra búsqueda." : "Elegí una versión en la sección Listas para consultar sus productos."}
      getRowId={(row) => row.id}
    />
  );
}
