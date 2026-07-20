import { useMemo, useState } from "react";
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";
import { Pencil, TrendingDown, TrendingUp } from "lucide-react";
import { RowActionButton, RowActions } from "@/components/common/RowActions";
import { MoneyCell, PrimaryCell, StatusBadge } from "@/components/common/VisualSystem";
import { OverflowTooltip } from "@/components/common/OverflowTooltip";
import { DataTable } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BasePriceRow } from "@/features/price-lists/types";
import { formatTimestampDate } from "@/lib/formatters";
import { formatMoney, formatPercentDelta, parseNonNegative, sanitizeNonNegativeDraft } from "@/features/price-lists/utils";

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
  const [editingRow, setEditingRow] = useState<BasePriceRow | null>(null);
  const [baseCostDraft, setBaseCostDraft] = useState("");

  const openBaseCostDialog = (row: BasePriceRow) => {
    setEditingRow(row);
    setBaseCostDraft(String(row.base_cost));
  };

  const saveBaseCost = () => {
    if (!editingRow) return;
    onSaveDraftValue(
      editingRow.item_id,
      parseNonNegative(baseCostDraft, editingRow.base_cost),
    );
    setEditingRow(null);
  };

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
        <PrimaryCell title={row.original.name} metadata={showAttributesInline ? row.original.attributes : undefined} />
      ),
      meta: {
        className: "w-[340px]",
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
        row.original.previous_base_cost !== null
          ? <MoneyCell value={row.original.previous_base_cost} className="text-muted-foreground" />
          : <div className="text-right text-muted-foreground">-</div>
      ),
    },
    {
      accessorKey: "base_cost",
      header: () => <div className="text-right">Costo base</div>,
      cell: ({ row }) => (
        <RowActions>
          <MoneyCell value={row.original.base_cost} />
          <RowActionButton
            label="Cambiar costo base"
            tone="edit"
            onClick={() => openBaseCostDialog(row.original)}
            disabled={isSaving}
          >
            <Pencil className="h-4 w-4" />
          </RowActionButton>
        </RowActions>
      ),
      meta: {
        className: "w-[150px]",
      },
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
      meta: {
        className: "w-[100px]",
      },
    },
    {
      accessorKey: "updated_at",
      header: () => "Última actualización",
      cell: ({ row }) => <span className="whitespace-nowrap text-sm text-muted-foreground">{formatTimestampDate(row.original.updated_at)}</span>,
      meta: {
        className: "w-[150px]",
      },
    },
    {
      accessorKey: "updated_by",
      header: () => "Usuario",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{renderUserName(row.original.updated_by)}</span>,
    },
  ], [isSaving, renderUserName, showAttributesInline, stockByItemId]);

  return (
    <>
      <DataTable
          columns={columns}
          data={rows}
          emptyMessage="No hay productos para mostrar."
          className="table-fixed min-w-[1780px]"
          columnVisibility={columnVisibility}
          getRowId={(row) => row.item_id}
          density="compact"
          reserveEmptyRows={pageSize}
      />
      <Dialog open={Boolean(editingRow)} onOpenChange={(open) => { if (!open) setEditingRow(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar costo base</DialogTitle>
            <DialogDescription>
              {editingRow ? `${editingRow.sku} · ${editingRow.name}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="base-cost-draft">Nuevo costo</Label>
            <Input
              id="base-cost-draft"
              type="number"
              min={0}
              step="any"
              value={baseCostDraft}
              onChange={(event) => setBaseCostDraft(sanitizeNonNegativeDraft(event.target.value))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  saveBaseCost();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditingRow(null)}>Cancelar</Button>
            <Button type="button" onClick={saveBaseCost} disabled={isSaving || baseCostDraft === ""}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
