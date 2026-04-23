import { useEffect, useMemo, useState } from "react";
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";
import { Package, PackageX, TrendingDown, TrendingUp } from "lucide-react";
import { OverflowTooltip } from "@/components/common/OverflowTooltip";
import { DataTable } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BasePriceRow } from "@/features/price-lists/types";
import { formatDateTime, formatPercentDelta, parseNonNegative, sanitizeNonNegativeDraft } from "@/features/price-lists/utils";
import { formatMoney } from "@/lib/formatters";

type BasePricesTableProps = {
  rows: BasePriceRow[];
  isSaving: boolean;
  pageSize: number;
  columnVisibility: VisibilityState;
  /** Map item_id → total stock qty */
  stockByItemId?: Map<string, number>;
  renderUserName: (userId: string | null) => string;
  onSaveDraftValue: (itemId: string, nextBaseCost: number) => void;
};

function BaseCostInputCell(props: {
  savedValue: number;
  isSaving: boolean;
  onCommit: (nextBaseCost: number) => void;
}) {
  const { savedValue, isSaving, onCommit } = props;
  const [isFocused, setIsFocused] = useState(false);
  const [localValue, setLocalValue] = useState(() => String(savedValue));

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(String(savedValue));
    }
  }, [savedValue, isFocused]);

  const commitValue = () => {
    const nextBaseCost = parseNonNegative(localValue, savedValue);
    if (nextBaseCost === savedValue) {
      setLocalValue(String(savedValue));
      return;
    }

    onCommit(nextBaseCost);
  };

  return (
    <div className="text-right">
      <Input
        className="ml-auto h-8 w-24 rounded-2xl px-3 text-right font-mono"
        type="number"
        min={0}
        step="any"
        value={localValue}
        disabled={isSaving && !isFocused}
        onFocus={() => setIsFocused(true)}
        onChange={(event) => {
          const nextValue = sanitizeNonNegativeDraft(event.target.value);
          setLocalValue(nextValue);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitValue();
            event.currentTarget.blur();
          }

          if (event.key === "Escape") {
            event.preventDefault();
            setLocalValue(String(savedValue));
            event.currentTarget.blur();
          }
        }}
        onBlur={() => {
          setIsFocused(false);
          commitValue();
        }}
      />
    </div>
  );
}

function StockBadge({ total }: { total: number | undefined }) {
  if (total === undefined) {
    return (
      <Badge variant="outline" className="h-5 gap-1 px-1.5 text-[10px] border-border/50 text-muted-foreground">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
        S/D
      </Badge>
    );
  }
  if (total <= 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="h-5 cursor-default gap-1 px-1.5 text-[10px] border-destructive/40 bg-destructive/8 text-destructive">
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
        <Badge variant="outline" className="h-5 cursor-default gap-1 px-1.5 text-[10px] border-emerald-500/40 bg-emerald-500/8 text-emerald-600 dark:text-emerald-400">
          <Package className="h-2.5 w-2.5" /> {total.toLocaleString("es-AR", { maximumFractionDigits: 1 })}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">Stock actual: {total}</TooltipContent>
    </Tooltip>
  );
}

export function BasePricesTable({
  rows,
  isSaving,
  pageSize,
  columnVisibility,
  stockByItemId,
  renderUserName,
  onSaveDraftValue,
}: BasePricesTableProps) {
  const showAttributesInline = columnVisibility.attributes === false;

  const columns = useMemo<ColumnDef<BasePriceRow, unknown>[]>(() => [
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
        className: "w-[280px]",
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
        className: "w-[240px]",
      },
    },
    {
      accessorKey: "brand",
      header: () => "Marca",
      cell: ({ row }) => <OverflowTooltip text={row.original.brand} className="block truncate" />,
      meta: {
        className: "w-[120px]",
      },
    },
    {
      accessorKey: "model",
      header: () => "Modelo",
      cell: ({ row }) => <OverflowTooltip text={row.original.model} className="block truncate" />,
      meta: {
        className: "w-[120px]",
      },
    },
    {
      accessorKey: "category",
      header: () => "Categoría",
      cell: ({ row }) => <OverflowTooltip text={row.original.category} className="block truncate" />,
      meta: {
        className: "w-[140px]",
      },
    },
    {
      accessorKey: "previous_base_cost",
      header: () => <div className="text-right">Costo anterior</div>,
      cell: ({ row }) => (
        <div className="text-right text-sm text-muted-foreground">
          {row.original.previous_base_cost !== null ? `$${formatMoney(row.original.previous_base_cost)}` : "-"}
        </div>
      ),
    },
    {
      accessorKey: "base_cost",
      header: () => <div className="text-right">Costo base</div>,
      cell: ({ row }) => (
        <BaseCostInputCell
          savedValue={row.original.base_cost}
          isSaving={isSaving}
          onCommit={(nextBaseCost) => onSaveDraftValue(row.original.item_id, nextBaseCost)}
        />
      ),
    },
    {
      accessorKey: "cost_variation_pct",
      header: () => <div className="text-right">Variación</div>,
      cell: ({ row }) => {
        const pct = row.original.cost_variation_pct;
        const isUp = pct !== null && pct > 0;
        const isDown = pct !== null && pct < 0;
        return (
          <div className={`flex items-center justify-end gap-1 text-sm font-medium ${
            isUp ? "text-rose-600 dark:text-rose-400"
            : isDown ? "text-emerald-600 dark:text-emerald-400"
            : "text-muted-foreground"
          }`}>
            {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : isDown ? <TrendingDown className="h-3.5 w-3.5" /> : null}
            {formatPercentDelta(pct)}
          </div>
        );
      },
    },
    {
      accessorKey: "updated_at",
      header: () => "Última actualización",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDateTime(row.original.updated_at)}</span>,
    },
    {
      accessorKey: "updated_by",
      header: () => "Usuario",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{renderUserName(row.original.updated_by)}</span>,
    },
  ], [isSaving, onSaveDraftValue, renderUserName, showAttributesInline, stockByItemId]);

  return (
    <div className="overflow-x-auto">
      <DataTable
        columns={columns}
        data={rows}
        emptyMessage="No hay productos para mostrar."
        className="table-fixed min-w-[1700px]"
        columnVisibility={columnVisibility}
        getRowId={(row) => row.item_id}
        rowClassName={showAttributesInline ? "h-14" : "h-12"}
        cellClassName={showAttributesInline ? "h-14 py-1.5" : "h-12 py-1"}
        reserveEmptyRows={pageSize}
      />
    </div>
  );
}
