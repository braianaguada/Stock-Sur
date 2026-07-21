import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/DataTable";
import { Checkbox } from "@/components/ui/checkbox";
import { CategoryBadge, PrimaryCell } from "@/components/common/VisualSystem";

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
      accessorKey: "articulo",
      header: () => "Articulo",
      cell: ({ row }) => <PrimaryCell title={row.original.articulo} metadata={`Codigo ${row.original.codigo || "sin codigo"}`} />,
    },
    {
      accessorKey: "medida",
      header: () => "Medida",
    },
    {
      accessorKey: "rubro",
      header: () => "Rubro",
      cell: ({ row }) => row.original.rubro ? <CategoryBadge>{row.original.rubro}</CategoryBadge> : "-",
    },
  ], [onSelectionChange, selectedIds]);

  return <DataTable columns={columns} data={rows} emptyMessage="Sin filas para mostrar" />;
}
