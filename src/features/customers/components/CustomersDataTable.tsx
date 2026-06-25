import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { RowActionButton, RowActions } from "@/components/common/RowActions";
import { TableBadge } from "@/components/common/TableBadge";
import { DataTable } from "@/components/data-table/DataTable";
import type { Customer } from "@/features/customers/types";
import { canUseCustomerForInvoiceA } from "@/features/customers/fiscal";

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
      accessorKey: "account_due_days",
      header: () => "Vencimiento",
      cell: ({ row }) => `${row.original.account_due_days ?? 30} días`,
      meta: {
        className: "w-[120px]",
      },
    },
    {
      accessorKey: "is_occasional",
      header: () => "Tipo",
      cell: ({ row }) => (
        <TableBadge tone={row.original.is_occasional ? "neutral" : "primary"}>
          {row.original.is_occasional ? "Sistema legacy" : "Registrado"}
        </TableBadge>
      ),
    },
    {
      id: "fiscal",
      header: () => "Factura A",
      cell: ({ row }) => {
        const readiness = canUseCustomerForInvoiceA(row.original, row.original.fiscal_profile);
        return (
          <TableBadge tone={readiness.allowed ? "success" : "warning"}>
            {readiness.allowed ? "Listo" : row.original.fiscal_profile?.validation_status ?? "Pendiente"}
          </TableBadge>
        );
      },
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
            label={row.original.is_occasional ? "Cliente ocasional no se edita desde Clientes" : "Editar"}
            tone="edit"
            disabled={row.original.is_occasional}
            onClick={() => onEdit(row.original)}
          >
            <Pencil className="h-4 w-4" />
          </RowActionButton>
          <RowActionButton
            label={row.original.is_occasional ? "Cliente ocasional no se elimina desde Clientes" : "Eliminar"}
            tone="danger"
            disabled={row.original.is_occasional}
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
