import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OrderLine } from "@/features/suppliers/types";

type SupplierOrderTableProps = {
  rows: OrderLine[];
  onQuantityChange: (lineId: string, value: string) => void;
  onRemove: (lineId: string) => void;
};

export function SupplierOrderTable({
  rows,
  onQuantityChange,
  onRemove,
}: SupplierOrderTableProps) {
  const columns = useMemo<ColumnDef<OrderLine, unknown>[]>(() => [
    {
      accessorKey: "supplier_code",
      header: () => "Codigo",
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.supplier_code ?? "S/COD"}
        </span>
      ),
      meta: {
        className: "w-[110px]",
      },
    },
    {
      accessorKey: "raw_description",
      header: () => "Descripcion",
      cell: ({ row }) => <span className="font-medium">{row.original.raw_description}</span>,
    },
    {
      accessorKey: "quantity",
      header: () => "Cantidad",
      cell: ({ row }) => (
        <Input
          type="number"
          min={1}
          step={1}
          value={row.original.quantity}
          onChange={(event) => onQuantityChange(row.original.id, event.target.value)}
          className="h-8"
        />
      ),
      meta: {
        className: "w-[96px]",
      },
    },
    {
      accessorKey: "cost",
      header: () => <div className="text-right">Costo</div>,
      cell: ({ row }) => (
        <div className="text-right font-mono">
          ${Number(row.original.cost).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
        </div>
      ),
      meta: {
        className: "w-[120px]",
        cellClassName: "text-right",
      },
    },
    {
      id: "subtotal",
      header: () => <div className="text-right">Subtotal</div>,
      cell: ({ row }) => (
        <div className="text-right font-semibold">
          ${(row.original.cost * row.original.quantity).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
        </div>
      ),
      meta: {
        className: "w-[130px]",
        cellClassName: "text-right",
      },
    },
    {
      id: "actions",
      header: () => "",
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => onRemove(row.original.id)}>
          Quitar
        </Button>
      ),
      meta: {
        className: "w-[92px]",
      },
    },
  ], [onQuantityChange, onRemove]);

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyMessage="Sin productos seleccionados"
      className="min-w-[720px]"
    />
  );
}
