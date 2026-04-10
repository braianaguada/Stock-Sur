import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { OverflowTooltip } from "@/components/common/OverflowTooltip";
import { DataTable } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import type { PriceListProductRow } from "@/features/price-lists/types";
import { formatMoney } from "@/features/price-lists/utils";

type PriceListProductsTableProps = {
  rows: PriceListProductRow[];
};

export function PriceListProductsTable({ rows }: PriceListProductsTableProps) {
  const columns = useMemo<ColumnDef<PriceListProductRow, unknown>[]>(() => [
    {
      accessorKey: "sku",
      header: () => "SKU",
      cell: ({ row }) => <OverflowTooltip text={row.original.sku} className="block truncate font-mono text-xs" />,
      meta: {
        className: "w-[130px]",
      },
    },
    {
      accessorKey: "name",
      header: () => "Nombre",
      cell: ({ row }) => (
        <div className="space-y-1">
          <OverflowTooltip text={row.original.name} className="block truncate font-medium" />
          {row.original.attributes ? (
            <OverflowTooltip text={row.original.attributes} className="block truncate text-xs text-muted-foreground" />
          ) : null}
        </div>
      ),
      meta: {
        className: "w-[320px]",
      },
    },
    {
      accessorKey: "attributes",
      header: () => "Atributos",
      cell: ({ row }) => <OverflowTooltip text={row.original.attributes} className="block truncate text-sm text-muted-foreground" />,
      meta: {
        className: "w-[260px]",
      },
    },
    {
      accessorKey: "calculated_price",
      header: () => <div className="text-right">Precio lista</div>,
      cell: ({ row }) => <div className="text-right font-mono">${formatMoney(row.original.calculated_price)}</div>,
    },
    {
      accessorKey: "needs_recalculation",
      header: () => "Estado",
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={row.original.needs_recalculation
            ? "px-2.5 py-0.5 text-[10px] border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
            : "px-2.5 py-0.5 text-[10px] border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-200"}
        >
          {row.original.needs_recalculation ? "Pendiente" : "Actualizado"}
        </Badge>
      ),
    },
  ], []);

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyMessage="No hay productos para mostrar."
      className="table-fixed"
    />
  );
}
