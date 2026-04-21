import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";

export type LineItemRow = {
  id: string;
  line_order?: number | null;
  sku?: string | null;
  description: string;
  quantity: number;
  unit?: string | null;
  unit_price: number;
  total: number;
};

type LineItemsTableProps = {
  rows: LineItemRow[];
  showOrder?: boolean;
  showSku?: boolean;
  currencyFormatter?: (value: number) => string;
};

export function LineItemsTable({
  rows,
  showOrder = true,
  showSku = false,
  currencyFormatter = (value) => `$${value.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`,
}: LineItemsTableProps) {
  const columns = useMemo<ColumnDef<LineItemRow, unknown>[]>(() => {
    const leadingColumns: ColumnDef<LineItemRow, unknown>[] = [];

    if (showOrder) {
      leadingColumns.push({
        id: "line_order",
        header: () => "#",
        cell: ({ row }) => row.original.line_order ?? "-",
      });
    }

    if (showSku) {
      leadingColumns.push({
        id: "sku",
        header: () => "SKU",
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.sku ?? "-"}</span>,
      });
    }

    return [
      ...leadingColumns,
      {
        accessorKey: "description",
        header: () => "Descripcion",
        cell: ({ row }) => <span className="font-medium">{row.original.description}</span>,
      },
      {
        accessorKey: "quantity",
        header: () => <div className="text-right">Cant.</div>,
        cell: ({ row }) => <div className="text-right">{Number(row.original.quantity).toLocaleString("es-AR")}</div>,
      },
      {
        accessorKey: "unit",
        header: () => "Unidad",
        cell: ({ row }) => row.original.unit ?? "un",
      },
      {
        accessorKey: "unit_price",
        header: () => <div className="text-right">P. Unit.</div>,
        cell: ({ row }) => <div className="text-right font-mono">{currencyFormatter(Number(row.original.unit_price))}</div>,
      },
      {
        accessorKey: "total",
        header: () => <div className="text-right">Importe</div>,
        cell: ({ row }) => <div className="text-right font-mono">{currencyFormatter(Number(row.original.total))}</div>,
      },
    ];
  }, [currencyFormatter, showOrder, showSku]);

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyMessage="Sin lineas para mostrar"
      rowClassName="odd:bg-background/35 hover:bg-primary/5"
      cellClassName="py-3.5 text-sm text-foreground/90"
    />
  );
}
