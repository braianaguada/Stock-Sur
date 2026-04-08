import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DemandProfile, StockHealth, StockRow } from "@/features/stock/types";

type StockCurrentTableProps = {
  rows: StockRow[];
  isLoading: boolean;
  pageSize: number;
  formatCoverage: (value: number | null, unit: "m" | "d") => string;
  formatQuantity: (value: number, unit: string | null) => string;
  healthLabel: Record<StockHealth, string>;
  healthClass: Record<StockHealth, string>;
  demandProfileLabel: Record<DemandProfile, string>;
  demandProfileClass: Record<DemandProfile, string>;
};

export function StockCurrentTable({
  rows,
  isLoading,
  pageSize,
  formatCoverage,
  formatQuantity,
  healthLabel,
  healthClass,
  demandProfileLabel,
  demandProfileClass,
}: StockCurrentTableProps) {
  const columns = useMemo<ColumnDef<StockRow, unknown>[]>(() => [
    {
      accessorKey: "item_sku",
      header: () => "SKU",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.item_sku}</span>,
    },
    {
      accessorKey: "item_name",
      header: () => "Nombre",
      cell: ({ row }) => <span className="text-sm font-semibold leading-6">{row.original.item_name}</span>,
    },
    {
      accessorKey: "item_unit",
      header: () => "Unidad",
      cell: ({ row }) => <span className="text-sm">{row.original.item_unit}</span>,
    },
    {
      id: "health",
      header: () => "Semáforo",
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn("px-2.5 py-0.5 text-[10px]", healthClass[row.original.health])}>
            {healthLabel[row.original.health]}
          </Badge>
          <Badge variant="outline" className={cn("px-2.5 py-0.5 text-[10px]", demandProfileClass[row.original.demand_profile])}>
            {demandProfileLabel[row.original.demand_profile]}
          </Badge>
        </div>
      ),
    },
    {
      id: "coverage",
      header: () => <div className="text-right">Cobertura</div>,
      cell: ({ row }) => (
        <div className="text-right font-mono">
          {row.original.low_rotation
            ? formatCoverage(row.original.months_of_cover_low_rotation, "m")
            : formatCoverage(row.original.days_of_cover, "d")}
        </div>
      ),
    },
    {
      id: "total",
      header: () => <div className="text-right">Stock</div>,
      cell: ({ row }) => (
        <div className="text-right text-[15px] font-bold">
          {formatQuantity(row.original.total, row.original.item_unit)}
        </div>
      ),
    },
  ], [demandProfileClass, demandProfileLabel, formatCoverage, formatQuantity, healthClass, healthLabel]);

  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      loadingMessage="Cargando..."
      emptyMessage="Sin movimientos de stock"
      reserveEmptyRows={pageSize}
    />
  );
}
