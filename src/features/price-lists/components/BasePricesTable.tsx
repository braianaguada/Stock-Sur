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
  pageSize: number;
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
  const [localValue, setLocalValue] = useState(draftValue);
  const lastCommittedValueRef = useRef<string>(draftValue);

  useEffect(() => {
    lastCommittedValueRef.current = draftValue;
  }, [draftValue]);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(draftValue);
    }
  }, [draftValue, isFocused]);

  useEffect(() => {
    if (!isFocused) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        const nextValue = inputRef.current?.value ?? localValue;
        if (nextValue !== lastCommittedValueRef.current) {
          lastCommittedValueRef.current = nextValue;
          onCommit(nextValue);
        }
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [isFocused, localValue, onCommit]);

  return (
    <div ref={wrapperRef} className="text-right">
      <Input
        ref={inputRef}
        key={itemId}
        className="ml-auto h-8 w-24 rounded-2xl px-3 text-right font-mono"
        type="number"
        min={0}
        step="any"
        value={localValue}
        onFocus={() => setIsFocused(true)}
        onChange={(event) => {
          const nextValue = sanitizeNonNegativeDraft(event.target.value);
          setLocalValue(nextValue);
          onDraftChange(nextValue);
        }}
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
  pageSize,
  renderUserName,
  onDraftChange,
  onSaveDraftValue,
}: BasePricesTableProps) {
  const tableRows = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        draftValue: baseCostDrafts[row.item_id] ?? "0",
      })),
    [baseCostDrafts, rows],
  );

  const columns = useMemo<ColumnDef<BasePriceRow & { draftValue: string }, unknown>[]>(() => [
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
          draftValue={row.original.draftValue}
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
  ], [onDraftChange, onSaveDraftValue, renderUserName]);

  return (
    <DataTable
      columns={columns}
      data={tableRows}
      emptyMessage="No hay productos para mostrar."
      className="table-fixed"
      rowClassName="h-12"
      cellClassName="h-12 py-0"
      reserveEmptyRows={pageSize}
    />
  );
}
