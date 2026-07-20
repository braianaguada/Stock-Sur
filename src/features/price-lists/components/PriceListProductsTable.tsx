import { useMemo } from "react";
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";
import { Pencil } from "lucide-react";
import { RowActionButton, RowActions } from "@/components/common/RowActions";
import { CategoryBadge, PrimaryCell, StatusBadge } from "@/components/common/VisualSystem";
import { OverflowTooltip } from "@/components/common/OverflowTooltip";
import { DataTable } from "@/components/data-table/DataTable";
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
    return <StatusBadge tone="muted">S/D</StatusBadge>;
  }
  if (total <= 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <StatusBadge tone="danger">Sin stock</StatusBadge>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">Stock actual: 0</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <StatusBadge tone="success">{total.toLocaleString("es-AR", { maximumFractionDigits: 1 })}</StatusBadge>
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
        <PrimaryCell title={row.original.name} metadata={showAttributesInline ? row.original.attributes : undefined} />
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
          <CategoryBadge
            title={operationalPrice.source === "PRODUCT_OVERRIDE" ? "Usa precio personalizado para esta lista" : "Usa precio calculado por formula"}
          >
            {operationalPrice.source === "PRODUCT_OVERRIDE" ? "Personalizado" : "Formula"}
          </CategoryBadge>
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
        <RowActions>
          <RowActionButton label="Precio personalizado" tone="edit" onClick={() => onEditProductOverride?.(row.original)}>
            <Pencil className="h-4 w-4" />
          </RowActionButton>
        </RowActions>
      ),
      meta: {
        className: "w-[90px]",
      },
    },
    {
      accessorKey: "needs_recalculation",
      header: () => "Estado",
      cell: ({ row }) => (
        <StatusBadge tone={row.original.needs_recalculation ? "danger" : "success"}>
          {row.original.needs_recalculation ? "Pendiente" : "Actualizado"}
        </StatusBadge>
      ),
      meta: {
        className: "w-[110px]",
      },
    },
  ], [onEditProductOverride, priceRoundingConfig, showAttributesInline, stockByItemId]);

  return (
    <DataTable
        columns={columns}
        data={rows}
        emptyMessage="No hay productos para mostrar."
        className="table-fixed min-w-[1440px]"
        columnVisibility={columnVisibility}
        density="compact"
      />
  );
}
