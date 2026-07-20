import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import { CategoryBadge, PrimaryCell, StatusBadge } from "@/components/common/VisualSystem";
import { buildItemDisplayName } from "@/lib/item-display";
import { cn } from "@/lib/utils";
import type { DemandProfile, StockHealth, StockRow } from "@/features/stock/types";

type StockCurrentTableProps = {
  rows: StockRow[];
  isLoading: boolean;
  pageSize: number;
  formatCoverage: (value: number | null, unit: "m" | "d") => string;
  formatQuantity: (value: number, unit: string | null) => string;
  healthLabel: Record<StockHealth, string>;
  demandProfileLabel: Record<DemandProfile, string>;
};

const healthTone: Record<StockHealth, "danger" | "warning" | "success" | "muted"> = { RED: "danger", YELLOW: "warning", GREEN: "success", GRAY: "muted" };

function CoverageBar({ row, formatCoverage }: { row: StockRow; formatCoverage: (value: number | null, unit: "m" | "d") => string }) {
  const isLowRot = row.low_rotation;
  const rawValue = isLowRot ? row.months_of_cover_low_rotation : row.days_of_cover;
  const maxScale = isLowRot ? 12 : 60; // months or days to reach 100%

  const pct = rawValue !== null && rawValue > 0
    ? Math.min(100, (rawValue / maxScale) * 100)
    : 0;

  const barColor =
    row.health === "RED" ? "bg-destructive"
    : row.health === "YELLOW" ? "bg-amber-500"
    : row.health === "GREEN" ? "bg-emerald-500"
    : "bg-muted-foreground/30";

  const label = formatCoverage(rawValue, isLowRot ? "m" : "d");

  return (
    <div className="min-w-[90px]">
      <div className="mb-1 text-right font-mono text-xs tabular-nums text-foreground/80">
        {label}
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: rawValue === null || rawValue <= 0 ? "0%" : `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function StockCurrentTable({
  rows,
  isLoading,
  pageSize,
  formatCoverage,
  formatQuantity,
  healthLabel,
  demandProfileLabel,
}: StockCurrentTableProps) {
  const columns = useMemo<ColumnDef<StockRow, unknown>[]>(() => [
    {
      accessorKey: "item_sku",
      header: () => "SKU",
      cell: ({ row }) => <span className="block truncate font-mono text-xs">{row.original.item_sku}</span>,
      meta: {
        className: "w-[140px]",
      },
    },
    {
      accessorKey: "item_name",
      header: () => "Nombre",
      cell: ({ row }) => (
        <PrimaryCell title={buildItemDisplayName({
              name: row.original.item_name,
              brand: row.original.item_brand,
              model: row.original.item_model,
              attributes: row.original.item_attributes,
            })} metadata={row.original.item_sku} />
      ),
      meta: {
        className: "w-[300px]",
      },
    },
    {
      accessorKey: "item_unit",
      header: () => "Unidad",
      cell: ({ row }) => <span className="text-sm">{row.original.item_unit}</span>,
      meta: {
        className: "w-[80px]",
      },
    },
    {
      id: "health",
      header: () => "Estado",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge tone={healthTone[row.original.health]}>
            {healthLabel[row.original.health]}
          </StatusBadge>
          <CategoryBadge>
            {demandProfileLabel[row.original.demand_profile]}
          </CategoryBadge>
        </div>
      ),
      meta: {
        className: "w-[180px]",
      },
    },
    {
      id: "coverage",
      header: () => <div className="text-right pr-2">Cobertura</div>,
      cell: ({ row }) => (
        <CoverageBar row={row.original} formatCoverage={formatCoverage} />
      ),
      meta: {
        className: "w-[140px]",
      },
    },
    {
      id: "total",
      header: () => <div className="text-right">Stock</div>,
      cell: ({ row }) => (
        <div className={cn(
          "text-right text-[15px] font-bold tabular-nums",
          row.original.total <= 0 ? "text-destructive" : "text-foreground",
        )}>
          {formatQuantity(row.original.total, row.original.item_unit)}
        </div>
      ),
      meta: {
        className: "w-[90px]",
      },
    },
  ], [demandProfileLabel, formatCoverage, formatQuantity, healthLabel]);

  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      loadingMessage="Cargando..."
      emptyMessage="No hay stock para mostrar"
      className="table-fixed"
      density="compact"
      reserveEmptyRows={pageSize}
    />
  );
}
