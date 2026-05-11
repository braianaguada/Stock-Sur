import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { RowActionButton, RowActions } from "@/components/common/RowActions";
import { DataTable } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import type { Customer } from "@/features/customers/types";

type CustomersDataTableProps = {
  customers: Customer[];
  isLoading: boolean;
  onViewAccount: (customer: Customer) => void;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
};

export function CustomersDataTable({
  customers,
  isLoading,
  onViewAccount,
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
        <RowActions>
          <RowActionButton
            label={row.original.is_occasional ? "El cliente ocasional no tiene cuenta corriente" : "Ver cuenta corriente"}
            tone="view"
            disabled={row.original.is_occasional}
            onClick={() => onViewAccount(row.original)}
          >
            <Eye className="h-4 w-4" />
          </RowActionButton>
          <RowActionButton
            label="Editar"
            tone="edit"
            onClick={() => onEdit(row.original)}
          >
            <Pencil className="h-4 w-4" />
          </RowActionButton>
          <RowActionButton
            label="Eliminar"
            tone="danger"
            onClick={() => onDelete(row.original)}
          >
            <Trash2 className="h-4 w-4" />
          </RowActionButton>
        </RowActions>
      ),
      meta: {
        className: "w-[96px]",
        cellClassName: "text-right",
      },
    },
  ], [onDelete, onEdit, onViewAccount]);

  return (
    <DataTable
      columns={columns}
      data={customers}
      isLoading={isLoading}
      emptyMessage="No hay clientes para mostrar"
    />
  );
}
