import { useMemo } from "react";
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";
import { Pencil, Package, PackageX } from "lucide-react";
import { OverflowTooltip } from "@/components/common/OverflowTooltip";
import { DataTable } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PriceListProductRow } from "@/features/price-lists/types";
import { formatMoney } from "@/features/price-lists/utils";
import { OperationalPriceDisplay } from "@/features/pricing/OperationalPriceDisplay";
import { getOperationalPrice } from "@/features/pricing/operational-price";
import type { PriceRoundingConfig } from "@/features/pricing/rounding";

type PriceListProductsTableProps = {
  rows: PriceListProductRow[];
  columnVisibility: VisibilityState;
  /** Map item_id → total stock qty */
  stockByItemId?: Map<string, number>;
  priceRoundingConfig?: PriceRoundingConfig | null;
  onEditProductOverride?: (row: PriceListProductRow) => void;
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

export function PriceListProductsTable({ rows, columnVisibility, stockByItemId, priceRoundingConfig, onEditProductOverride }: PriceListProductsTableProps) {
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
      header: () => <div className="text-right">Precio operativo</div>,
      cell: ({ row }) => {
        if (row.original.manual_price_enabled && row.original.final_price_override !== null) {
          return (
            <div className="flex flex-col items-end gap-0.5">
              <span className="font-mono text-sm font-bold text-foreground">
                ${formatMoney(row.original.final_price_override)}
              </span>
              <span className="truncate text-[10px] text-muted-foreground">
                Formula: ${formatMoney(row.original.calculated_price)}
              </span>
            </div>
          );
        }

        return (
          <OperationalPriceDisplay
            value={row.original.calculated_price}
            config={priceRoundingConfig}
            formatValue={(value) => `$${formatMoney(value)}`}
            valueClassName="font-mono text-sm font-bold text-foreground"
          />
        );
      },
      meta: {
        className: "w-[150px]",
      },
    },
    {
      id: "price_source",
      header: () => "Precio",
      cell: ({ row }) => {
        const operationalPrice = getOperationalPrice({
          calculatedPrice: row.original.calculated_price,
          manualOverridePrice: row.original.final_price_override,
          manualPriceEnabled: row.original.manual_price_enabled,
          config: priceRoundingConfig,
        });
        return (
          <Badge
            variant="outline"
            className={operationalPrice.source === "PRODUCT_OVERRIDE"
              ? "px-2.5 py-0.5 text-[10px] border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-200"
              : "px-2.5 py-0.5 text-[10px] border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/20 dark:bg-slate-500/10 dark:text-slate-200"}
            title={operationalPrice.source === "PRODUCT_OVERRIDE" ? "Usa precio personalizado para esta lista" : "Usa precio calculado por formula"}
          >
            {operationalPrice.source === "PRODUCT_OVERRIDE" ? "Personalizado" : "Formula"}
          </Badge>
        );
      },
      meta: {
        className: "w-[120px]",
      },
    },
    {
      id: "estimated_margin",
      header: () => <div className="text-right">Margen est.</div>,
      cell: ({ row }) => {
        const operationalPrice = getOperationalPrice({
          calculatedPrice: row.original.calculated_price,
          manualOverridePrice: row.original.final_price_override,
          manualPriceEnabled: row.original.manual_price_enabled,
          config: priceRoundingConfig,
        });
        const baseCost = Number(row.original.base_cost) || 0;
        const margin = baseCost > 0 ? ((operationalPrice.price - baseCost) / baseCost) * 100 : null;
        return (
          <div className="text-right font-mono text-xs">
            {margin === null ? "-" : `${margin.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`}
          </div>
        );
      },
      meta: {
        className: "w-[110px]",
      },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Acciones</div>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="icon" onClick={() => onEditProductOverride?.(row.original)} title="Precio personalizado">
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      ),
      meta: {
        className: "w-[90px]",
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
  ], [onEditProductOverride, priceRoundingConfig, showAttributesInline, stockByItemId]);

  return (
    <div className="overflow-x-auto">
      <DataTable
        columns={columns}
        data={rows}
        emptyMessage="No hay productos para mostrar."
        className="table-fixed min-w-[1440px]"
        columnVisibility={columnVisibility}
        rowClassName={showAttributesInline ? "h-14" : "h-12"}
        cellClassName={showAttributesInline ? "h-14 py-1.5" : "h-12 py-1"}
      />
    </div>
  );
}
