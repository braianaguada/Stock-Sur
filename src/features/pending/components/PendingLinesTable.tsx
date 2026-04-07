import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Link2 } from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/button";
import type { PendingLine } from "@/features/pending/types";

type PendingLinesTableProps = {
  lines: PendingLine[];
  isLoading: boolean;
  onAssign: (line: PendingLine) => void;
};

export function PendingLinesTable({
  lines,
  isLoading,
  onAssign,
}: PendingLinesTableProps) {
  const columns = useMemo<ColumnDef<PendingLine, unknown>[]>(() => [
    {
      accessorKey: "raw_description",
      header: () => "Descripcion",
      cell: ({ row }) => (
        <div className="max-w-xs space-y-1 text-sm">
          <p className="truncate font-medium">{row.original.raw_description}</p>
          <p className="text-xs text-muted-foreground">Pendiente de match manual</p>
        </div>
      ),
    },
    {
      accessorKey: "supplier_code",
      header: () => "Cod. prov.",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.supplier_code ?? "-"}</span>,
    },
    {
      accessorKey: "price",
      header: () => <div className="text-right">Precio</div>,
      cell: ({ row }) => (
        <div className="text-right font-mono">
          {Number(row.original.price).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
        </div>
      ),
    },
    {
      id: "price_list",
      header: () => "Lista / Proveedor",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.price_list_versions?.price_lists?.name ?? "-"} /{" "}
          {row.original.price_list_versions?.price_lists?.suppliers?.name ?? "-"}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => "Accion",
      cell: ({ row }) => (
        <Button variant="outline" size="sm" onClick={() => onAssign(row.original)}>
          <Link2 className="mr-1 h-3 w-3" /> Asignar
        </Button>
      ),
      meta: {
        className: "w-[110px]",
      },
    },
  ], [onAssign]);

  return (
    <DataTable
      columns={columns}
      data={lines}
      isLoading={isLoading}
      emptyMessage="No hay lineas pendientes."
    />
  );
}
