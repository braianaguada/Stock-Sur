import { useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import { Input } from "@/components/ui/input";
import type { BasePriceRow } from "@/features/price-lists/types";
import { formatDateTime, formatMoney, formatPercentDelta, sanitizeNonNegativeDraft } from "@/features/price-lists/utils";

type BasePricesTableProps = {
  rows: BasePriceRow[];
  baseCostDrafts: Record<string, string>;
  isSaving: boolean;
  renderUserName: (userId: string | null) => string;
  onDraftChange: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  onSaveDraftValue: (itemId: string, draftValue: string) => void;
};

function BaseCostInputCell(props: {
  itemId: string;
  draftValue: string;
  onDraftChange: (nextValue: string) => void;
  onCommit: (draftValue: string) => void;
}) {
  const { itemId, draftValue, onDraftChange, onCommit } = props;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const lastCommittedValueRef = useRef<string>(draftValue);

  useEffect(() => {
    lastCommittedValueRef.current = draftValue;
  }, [draftValue]);

  useEffect(() => {
    if (!isFocused) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        const nextValue = inputRef.current?.value ?? draftValue;
        if (nextValue !== lastCommittedValueRef.current) {
          lastCommittedValueRef.current = nextValue;
          onCommit(nextValue);
        }
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [draftValue, isFocused, onCommit]);

  return (
    <div ref={wrapperRef} className="text-right">
      <Input
        ref={inputRef}
        key={itemId}
        className="ml-auto h-9 w-20 rounded-2xl text-right font-mono"
        type="number"
        min={0}
        step="any"
        value={draftValue}
        onFocus={() => setIsFocused(true)}
        onChange={(event) => onDraftChange(sanitizeNonNegativeDraft(event.target.value))}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            const nextValue = event.currentTarget.value;
            lastCommittedValueRef.current = nextValue;
            onCommit(nextValue);
            event.currentTarget.blur();
          }
        }}
        onBlur={(event) => {
          setIsFocused(false);
          const nextValue = event.currentTarget.value;
          if (nextValue !== lastCommittedValueRef.current) {
            lastCommittedValueRef.current = nextValue;
            onCommit(nextValue);
          }
        }}
      />
    </div>
  );
}

export function BasePricesTable({
  rows,
  baseCostDrafts,
  renderUserName,
  onDraftChange,
  onSaveDraftValue,
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
        <BaseCostInputCell
          itemId={row.original.item_id}
          draftValue={baseCostDrafts[row.original.item_id] ?? "0"}
          onDraftChange={(nextValue) =>
            onDraftChange((prev) => ({
              ...prev,
              [row.original.item_id]: nextValue,
            }))}
          onCommit={(draftValue) => onSaveDraftValue(row.original.item_id, draftValue)}
        />
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
  ], [baseCostDrafts, onDraftChange, onSaveDraftValue, renderUserName]);

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyMessage="No hay productos para mostrar."
    />
  );
}
