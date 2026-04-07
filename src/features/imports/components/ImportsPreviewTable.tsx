import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";

type PreviewRow = {
  supplier_code: string | null;
  raw_description: string;
  price: number;
};

type ImportsPreviewTableProps = {
  rows: PreviewRow[];
};

export function ImportsPreviewTable({ rows }: ImportsPreviewTableProps) {
  const columns = useMemo<ColumnDef<PreviewRow, unknown>[]>(() => [
    {
      accessorKey: "supplier_code",
      header: () => "Cod. Proveedor",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.supplier_code || "-"}</span>,
    },
    {
      accessorKey: "raw_description",
      header: () => "Descripcion",
      cell: ({ row }) => <span className="text-sm">{row.original.raw_description}</span>,
    },
    {
      accessorKey: "price",
      header: () => <div className="text-right">Precio</div>,
      cell: ({ row }) => (
        <div className="text-right font-mono">
          {row.original.price.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
        </div>
      ),
    },
  ], []);

  return <DataTable columns={columns} data={rows} emptyMessage="Sin filas para previsualizar" />;
}
