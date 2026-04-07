import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import { Checkbox } from "@/components/ui/checkbox";

export type LegacyCatalogTableRow = {
  id: string;
  codigo: string;
  articulo: string;
  medida: string;
  rubro: string;
};

type LegacyCatalogTableProps = {
  rows: LegacyCatalogTableRow[];
  selectedIds: Set<string>;
  onSelectionChange: (id: string, checked: boolean) => void;
};

export function LegacyCatalogTable({
  rows,
  selectedIds,
  onSelectionChange,
}: LegacyCatalogTableProps) {
  const columns = useMemo<ColumnDef<LegacyCatalogTableRow, unknown>[]>(() => [
    {
      id: "selected",
      header: () => "Sel.",
      cell: ({ row }) => (
        <Checkbox
          checked={selectedIds.has(row.original.id)}
          onCheckedChange={(checked) => onSelectionChange(row.original.id, checked === true)}
        />
      ),
      meta: {
        className: "w-[56px]",
      },
    },
    {
      accessorKey: "codigo",
      header: () => "Codigo",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.codigo}</span>,
    },
    {
      accessorKey: "articulo",
      header: () => "Articulo",
    },
    {
      accessorKey: "medida",
      header: () => "Medida",
    },
    {
      accessorKey: "rubro",
      header: () => "Rubro",
      cell: ({ row }) => row.original.rubro || "-",
    },
  ], [onSelectionChange, selectedIds]);

  return <DataTable columns={columns} data={rows} emptyMessage="Sin filas para mostrar" />;
}
