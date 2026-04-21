import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Customer } from "@/features/customers/types";

type CustomersDataTableProps = {
  customers: Customer[]; 
  isLoading: boolean;
  onOpenAccount: (customer: Customer) => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
};

export function CustomersDataTable({
  customers,
  isLoading,
  onOpenAccount,
  onEdit,
  onDelete,
}: CustomersDataTableProps) {
  const columns = useMemo<ColumnDef<Customer, unknown>[]>(() => [
    {
      accessorKey: "name",
      header: () => "Nombre",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: "cuit",
      header: () => "CUIT",
      cell: ({ row }) => row.original.cuit ?? "-",
    },
    {
      accessorKey: "email",
      header: () => "Email",
      cell: ({ row }) => row.original.email ?? "-",
    },
    {
      accessorKey: "phone",
      header: () => "Telefono",
      cell: ({ row }) => row.original.phone ?? "-",
    },
    {
      accessorKey: "is_occasional",
      header: () => "Tipo",
      cell: ({ row }) => (
        <Badge variant={row.original.is_occasional ? "secondary" : "default"}>
          {row.original.is_occasional ? "Ocasional" : "Regular"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right">Acciones</div>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => onOpenAccount(row.original)}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={() => onEdit(row.original)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={() => onDelete(row.original)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
      meta: {
        className: "w-[132px]",
        cellClassName: "text-right",
      },
    },
  ], [onDelete, onEdit, onOpenAccount]);

  return (
    <DataTable
      columns={columns}
      data={customers}
      isLoading={isLoading}
      emptyMessage="No se encontraron clientes"
    />
  );
}
