import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import type { Movement, MovementType } from "@/features/stock/types";

type StockMovementsTableProps = {
  movements: Movement[];
  isLoading: boolean;
  formatQuantity: (value: number, unit: string | null) => string;
  typeIcon: (type: MovementType) => JSX.Element;
  typeLabel: Record<MovementType, string>;
};

export function StockMovementsTable({
  movements,
  isLoading,
  formatQuantity,
  typeIcon,
  typeLabel,
}: StockMovementsTableProps) {
  const columns = useMemo<ColumnDef<Movement, unknown>[]>(() => [
    {
      accessorKey: "created_at",
      header: () => "Fecha/Hora",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.original.created_at).toLocaleString("es-AR")}
        </span>
      ),
    },
    {
      accessorKey: "created_by_name",
      header: () => "Usuario",
      cell: ({ row }) => <span className="text-sm">{row.original.created_by_name ?? "Sistema"}</span>,
    },
    {
      accessorKey: "type",
      header: () => "Tipo",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {typeIcon(row.original.type)}
          <span className="text-sm">{typeLabel[row.original.type]}</span>
        </div>
      ),
    },
    {
      id: "item",
      header: () => "Item",
      cell: ({ row }) => <span className="font-medium">{row.original.items?.name ?? "-"}</span>,
    },
    {
      accessorKey: "quantity",
      header: () => <div className="text-right">Cantidad</div>,
      cell: ({ row }) => (
        <div className="text-right font-mono">
          {formatQuantity(row.original.quantity, row.original.items?.unit ?? null)}
        </div>
      ),
    },
    {
      accessorKey: "reference",
      header: () => "Referencia",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.reference ?? "-"}</span>,
    },
  ], [formatQuantity, typeIcon, typeLabel]);

  return (
    <DataTable
      columns={columns}
      data={movements}
      isLoading={isLoading}
      emptyMessage="Sin movimientos"
    />
  );
}
