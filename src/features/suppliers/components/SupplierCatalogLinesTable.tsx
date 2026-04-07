import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CatalogLine } from "@/features/suppliers/types";

type SupplierCatalogLinesTableProps = {
  lines: CatalogLine[];
  activeVersionId: string | null;
  isLoading: boolean;
  quantities: Record<string, number>;
  onQuantityChange: (lineId: string, value: string) => void;
  onAdd: (line: CatalogLine) => void;
};

export function SupplierCatalogLinesTable({
  lines,
  activeVersionId,
  isLoading,
  quantities,
  onQuantityChange,
  onAdd,
}: SupplierCatalogLinesTableProps) {
  const columns = useMemo<ColumnDef<CatalogLine, unknown>[]>(() => [
    {
      accessorKey: "supplier_code",
      header: () => "Codigo",
      cell: ({ row }) => (
        <span className="truncate font-mono text-xs" title={row.original.supplier_code ?? "-"}>
          {row.original.supplier_code ?? "-"}
        </span>
      ),
      meta: {
        className: "w-[140px]",
      },
    },
    {
      accessorKey: "raw_description",
      header: () => "Descripcion",
      cell: ({ row }) => (
        <span className="truncate text-sm" title={row.original.raw_description}>
          {row.original.raw_description}
        </span>
      ),
    },
    {
      accessorKey: "cost",
      header: () => <div className="text-right">Costo</div>,
      cell: ({ row }) => (
        <div className="text-right font-mono">
          {Number(row.original.cost).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
        </div>
      ),
      meta: {
        className: "w-[140px]",
        cellClassName: "text-right",
      },
    },
    {
      id: "quantity",
      header: () => "Cantidad",
      cell: ({ row }) => (
        <Input
          type="number"
          min={1}
          step={1}
          value={quantities[row.original.id] ?? 1}
          onChange={(event) => onQuantityChange(row.original.id, event.target.value)}
        />
      ),
      meta: {
        className: "w-[110px]",
      },
    },
    {
      id: "actions",
      header: () => "",
      cell: ({ row }) => (
        <Button size="sm" onClick={() => onAdd(row.original)}>
          Agregar
        </Button>
      ),
      meta: {
        className: "w-[120px]",
      },
    },
  ], [onAdd, onQuantityChange, quantities]);

  const emptyMessage = !activeVersionId
    ? "Selecciona una version para ver lineas"
    : "Sin resultados";

  return (
    <DataTable
      columns={columns}
      data={lines}
      isLoading={Boolean(activeVersionId) && isLoading}
      loadingMessage="Cargando..."
      emptyMessage={emptyMessage}
      className="table-fixed min-w-[760px]"
    />
  );
}
