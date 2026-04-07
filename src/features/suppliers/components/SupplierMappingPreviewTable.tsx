import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";

type PreviewRow = {
  id: string;
  values: string[];
};

type SupplierMappingPreviewTableProps = {
  headers: string[];
  rows: string[][];
  maxColumns?: number;
  maxRows?: number;
};

export function SupplierMappingPreviewTable({
  headers,
  rows,
  maxColumns = 8,
  maxRows = 20,
}: SupplierMappingPreviewTableProps) {
  const limitedHeaders = useMemo(() => headers.slice(0, maxColumns), [headers, maxColumns]);

  const previewRows = useMemo<PreviewRow[]>(
    () => rows.slice(0, maxRows).map((row, index) => ({
      id: `preview-${index}`,
      values: limitedHeaders.map((_, columnIndex) => row[columnIndex] ?? ""),
    })),
    [limitedHeaders, maxRows, rows],
  );

  const columns = useMemo<ColumnDef<PreviewRow, unknown>[]>(
    () =>
      limitedHeaders.map((header, index) => ({
        id: `col-${index}`,
        header: () => header,
        cell: ({ row }) => <span className="text-xs">{row.original.values[index] ?? ""}</span>,
      })),
    [limitedHeaders],
  );

  return (
    <DataTable
      columns={columns}
      data={previewRows}
      emptyMessage="Sin filas para previsualizar"
      className="w-full"
    />
  );
}
