import { useMemo, useRef } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import { Input } from "@/components/ui/input";
import type { BasePriceRow } from "@/features/price-lists/types";
import { formatDateTime, formatMoney, formatPercentDelta, sanitizeNonNegativeDraft } from "@/features/price-lists/utils";

type BasePricesTableProps = {
  rows: BasePriceRow[];
  isSaving: boolean;
  pageSize: number;
  renderUserName: (userId: string | null) => string;
  onSaveDraftValue: (itemId: string, draftValue: string) => void;
};

function BaseCostInputCell(props: {
  itemId: string;
  baseCost: number | null;
  onCommit: (draftValue: string) => void;
}) {
  const { itemId, baseCost, onCommit } = props;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const committedValueRef = useRef(String(baseCost ?? 0));

  return (
    <div className="text-right">
      <Input
        ref={inputRef}
        key={`${itemId}-${baseCost ?? 0}`}
        className="ml-auto h-9 w-28 rounded-2xl px-3 text-right font-mono"
        type="number"
        min={0}
        step="any"
        defaultValue={committedValueRef.current}
        onChange={(event) => {
          const sanitizedValue = sanitizeNonNegativeDraft(event.target.value);
          if (sanitizedValue !== event.target.value) {
            event.target.value = sanitizedValue;
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }

          if (event.key === "Escape") {
            event.preventDefault();
            event.currentTarget.value = committedValueRef.current;
            event.currentTarget.blur();
          }
        }}
        onBlur={(event) => {
          const nextValue = sanitizeNonNegativeDraft(event.currentTarget.value);
          event.currentTarget.value = nextValue;

          if (nextValue !== committedValueRef.current) {
            committedValueRef.current = nextValue;
            onCommit(nextValue);
          }
        }}
      />
    </div>
  );
}

export function BasePricesTable({
  rows,
  pageSize,
  renderUserName,
  onSaveDraftValue,
}: BasePricesTableProps) {
  const columns = useMemo<ColumnDef<BasePriceRow, unknown>[]>(() => [
    {
      accessorKey: "sku",
      header: () => "SKU",
      cell: ({ row }) => <span className="block truncate font-mono text-xs">{row.original.sku ?? "-"}</span>,
      meta: {
        className: "w-[130px]",
      },
    },
    {
      accessorKey: "name",
      header: () => "Nombre",
      cell: ({ row }) => <span className="block truncate font-medium">{row.original.name}</span>,
      meta: {
        className: "w-[300px]",
      },
    },
    {
      accessorKey: "brand",
      header: () => "Marca",
      cell: ({ row }) => <span className="block truncate">{row.original.brand ?? "-"}</span>,
      meta: {
        className: "w-[120px]",
      },
    },
    {
      accessorKey: "model",
      header: () => "Modelo",
      cell: ({ row }) => <span className="block truncate">{row.original.model ?? "-"}</span>,
      meta: {
        className: "w-[120px]",
      },
    },
    {
      accessorKey: "category",
      header: () => "Categoría",
      cell: ({ row }) => <span className="block truncate">{row.original.category ?? "-"}</span>,
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
          itemId={row.original.item_id}
          baseCost={row.original.base_cost}
          onCommit={(draftValue) => onSaveDraftValue(row.original.item_id, draftValue)}
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
  ], [onSaveDraftValue, renderUserName]);

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyMessage="No hay productos para mostrar."
      className="table-fixed"
      rowClassName="h-12"
      cellClassName="h-12 py-0"
      reserveEmptyRows={pageSize}
    />
  );
}
