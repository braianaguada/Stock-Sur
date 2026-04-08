import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import type { NormalizeDiagnostics } from "@/features/suppliers/types";

type DroppedRow = NonNullable<NormalizeDiagnostics["sampleDropped"]>[number];

type SupplierDroppedRowsTableProps = {
  rows: DroppedRow[];
};

export function SupplierDroppedRowsTable({ rows }: SupplierDroppedRowsTableProps) {
  const columns = useMemo<ColumnDef<DroppedRow, unknown>[]>(() => [
    {
      accessorKey: "rowIndex",
      header: () => "Fila",
      meta: {
        className: "w-[96px]",
      },
    },
    {
      accessorKey: "reason",
      header: () => "Motivo",
      meta: {
        className: "w-[180px]",
      },
    },
    {
      id: "rowPreview",
      header: () => "Muestra",
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.rowPreview.join(" | ")}
        </span>
      ),
    },
  ], []);

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyMessage="Sin muestra disponible"
    />
  );
}
