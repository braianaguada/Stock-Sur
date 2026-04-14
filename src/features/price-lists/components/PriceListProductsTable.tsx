import { useMemo } from "react";
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";
import { Package, PackageX } from "lucide-react";
import { OverflowTooltip } from "@/components/common/OverflowTooltip";
import { DataTable } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PriceListProductRow } from "@/features/price-lists/types";
import { formatMoney } from "@/features/price-lists/utils";

type PriceListProductsTableProps = {
  rows: PriceListProductRow[];
  columnVisibility: VisibilityState;
  /** Map item_id → total stock qty */
  stockByItemId?: Map<string, number>;
};

function StockBadge({ total }: { total: number | undefined }) {
  if (total === undefined) {
    return (
      <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px] border-border/50 text-muted-foreground font-normal">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
        S/D
      </Badge>
    );
  }
  if (total <= 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="h-5 cursor-default gap-1 px-1.5 text-[10px] border-destructive/40 bg-destructive/8 text-destructive font-medium">
            <PackageX className="h-2.5 w-2.5" /> Sin stock
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">Stock actual: 0</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="h-5 cursor-default gap-1 px-1.5 text-[10px] border-emerald-500/40 bg-emerald-500/8 text-emerald-600 dark:text-emerald-400 font-medium">
          <Package className="h-2.5 w-2.5" /> {total.toLocaleString("es-AR", { maximumFractionDigits: 1 })}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">Stock actual: {total}</TooltipContent>
    </Tooltip>
  );
}

export function PriceListProductsTable({ rows, columnVisibility, stockByItemId }: PriceListProductsTableProps) {
  const showAttributesInline = columnVisibility.attributes === false;

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
        <div className="min-w-0">
          <OverflowTooltip text={row.original.name} className="block truncate text-sm font-medium leading-5" />
          {showAttributesInline && row.original.attributes ? (
            <OverflowTooltip text={row.original.attributes} className="block truncate text-[11px] leading-4 text-muted-foreground" />
          ) : null}
        </div>
      ),
      meta: {
        className: "w-[300px]",
      },
    },
    {
      id: "stock",
      header: () => "Stock",
      cell: ({ row }) => <StockBadge total={stockByItemId?.get(row.original.item_id)} />,
      meta: {
        className: "w-[110px]",
      },
    },
    {
      accessorKey: "attributes",
      header: () => "Atributos",
      cell: ({ row }) => <OverflowTooltip text={row.original.attributes} className="block truncate text-xs text-muted-foreground" />,
      meta: {
        className: "w-[260px]",
      },
    },
    {
      accessorKey: "calculated_price",
      header: () => <div className="text-right">Precio lista</div>,
      cell: ({ row }) => <div className="text-right font-mono text-sm font-bold text-foreground">${formatMoney(row.original.calculated_price)}</div>,
      meta: {
        className: "w-[120px]",
      },
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
      meta: {
        className: "w-[110px]",
      },
    },
  ], [showAttributesInline, stockByItemId]);

  return (
    <div className="overflow-x-auto">
      <DataTable
        columns={columns}
        data={rows}
        emptyMessage="No hay productos para mostrar."
        className="table-fixed min-w-[1240px]"
        columnVisibility={columnVisibility}
        rowClassName={showAttributesInline ? "h-14" : "h-12"}
        cellClassName={showAttributesInline ? "h-14 py-1.5" : "h-12 py-1"}
      />
    </div>
  );
}
