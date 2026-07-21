import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import { MoneyCell, PrimaryCell } from "@/components/common/VisualSystem";

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
      accessorKey: "raw_description",
      header: () => "Producto",
      cell: ({ row }) => (
        <PrimaryCell
          title={row.original.raw_description}
          metadata={row.original.supplier_code ? `Codigo ${row.original.supplier_code}` : "Sin codigo de proveedor"}
        />
      ),
    },
    {
      accessorKey: "price",
      header: () => <div className="text-right">Precio</div>,
      cell: ({ row }) => <MoneyCell value={row.original.price.toLocaleString("es-AR", { minimumFractionDigits: 2 })} format="plain" />,
      meta: { className: "text-right", cellClassName: "text-right" },
    },
  ], []);

  return <DataTable columns={columns} data={rows} emptyMessage="Sin filas para previsualizar" />;
}
