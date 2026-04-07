import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import { Input } from "@/components/ui/input";
import type { BasePriceRow } from "@/features/price-lists/types";
import { formatDateTime, formatMoney, formatPercentDelta, parseNonNegative, sanitizeNonNegativeDraft } from "@/features/price-lists/utils";

type BasePricesTableProps = {
  rows: BasePriceRow[];
  baseCostDrafts: Record<string, string>;
  isSaving: boolean;
  renderUserName: (userId: string | null) => string;
  onDraftChange: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  onSave: (itemId: string, baseCost: number) => void;
};

export function BasePricesTable({
  rows,
  baseCostDrafts,
  renderUserName,
  onDraftChange,
  onSave,
}: BasePricesTableProps) {
  const columns = useMemo<ColumnDef<BasePriceRow, unknown>[]>(() => [
    {
      accessorKey: "sku",
      header: () => "SKU",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.sku ?? "-"}</span>,
    },
    {
      accessorKey: "name",
      header: () => "Nombre",
      cell: ({ row }) => <span className="font-medium leading-6">{row.original.name}</span>,
    },
    {
      accessorKey: "brand",
      header: () => "Marca",
      cell: ({ row }) => row.original.brand ?? "-",
    },
    {
      accessorKey: "model",
      header: () => "Modelo",
      cell: ({ row }) => row.original.model ?? "-",
    },
    {
      accessorKey: "category",
      header: () => "Categoria",
      cell: ({ row }) => row.original.category ?? "-",
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
        <div className="text-right">
          <Input
            className="ml-auto h-9 w-20 rounded-2xl text-right font-mono"
            type="number"
            min={0}
            step="any"
            value={baseCostDrafts[row.original.item_id] ?? "0"}
            onChange={(event) =>
              onDraftChange((prev) => ({
                ...prev,
                [row.original.item_id]: sanitizeNonNegativeDraft(event.target.value),
              }))}
            onBlur={() => onSave(row.original.item_id, parseNonNegative(baseCostDrafts[row.original.item_id] ?? "0", 0))}
          />
        </div>
      ),
    },
    {
      accessorKey: "cost_variation_pct",
      header: () => <div className="text-right">Variacion</div>,
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
      header: () => "Ultima actualizacion",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDateTime(row.original.updated_at)}</span>,
    },
    {
      accessorKey: "updated_by",
      header: () => "Usuario",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{renderUserName(row.original.updated_by)}</span>,
    },
  ], [baseCostDrafts, onDraftChange, onSave, renderUserName]);

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyMessage="No hay productos para mostrar."
    />
  );
}
