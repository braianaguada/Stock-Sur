import { useEffect, useMemo, useState } from "react";
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";
import { OverflowTooltip } from "@/components/common/OverflowTooltip";
import { DataTable } from "@/components/data-table/DataTable";
import { Input } from "@/components/ui/input";
import type { BasePriceRow } from "@/features/price-lists/types";
import { formatDateTime, formatMoney, formatPercentDelta, parseNonNegative, sanitizeNonNegativeDraft } from "@/features/price-lists/utils";

type BasePricesTableProps = {
  rows: BasePriceRow[];
  isSaving: boolean;
  pageSize: number;
  columnVisibility: VisibilityState;
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

export function BasePricesTable({
  rows,
  isSaving,
  pageSize,
  columnVisibility,
  renderUserName,
  onSaveDraftValue,
}: BasePricesTableProps) {
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
        <div className="space-y-1">
          <OverflowTooltip text={row.original.name} className="block truncate font-medium" />
          {row.original.attributes ? (
            <OverflowTooltip text={row.original.attributes} className="block truncate text-xs text-muted-foreground" />
          ) : null}
        </div>
      ),
      meta: {
        className: "w-[300px]",
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
        className: "w-[150px]",
      },
    },
    {
      accessorKey: "previous_base_cost",
      header: () => <div className="text-right">Costo anterior</div>,
      cell: ({ row }) => (
        <div className="text-right">
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
      cell: ({ row }) => (
        <div
          className={`text-right text-sm ${
            row.original.cost_variation_pct !== null && row.original.cost_variation_pct > 0
              ? "text-rose-600"
              : row.original.cost_variation_pct !== null && row.original.cost_variation_pct < 0
                ? "text-emerald-600"
                : "text-muted-foreground"
          }`}
        >
          {formatPercentDelta(row.original.cost_variation_pct)}
        </div>
      ),
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
  ], [isSaving, onSaveDraftValue, renderUserName]);

  return (
    <div className="overflow-x-auto">
      <DataTable
        columns={columns}
        data={rows}
        emptyMessage="No hay productos para mostrar."
        className="table-fixed min-w-[1660px]"
        columnVisibility={columnVisibility}
        getRowId={(row) => row.item_id}
        rowClassName="h-16"
        cellClassName="h-16 py-2"
        reserveEmptyRows={pageSize}
      />
    </div>
  );
}
