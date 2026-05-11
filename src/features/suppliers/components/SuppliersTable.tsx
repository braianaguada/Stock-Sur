import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, RotateCcw, Trash2, Upload } from "lucide-react";
import { RowActionButton, RowActions } from "@/components/common/RowActions";
import { DataTable } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { normalizeWhatsappNumber } from "@/lib/whatsapp";
import type { Supplier } from "@/features/suppliers/types";

export function SuppliersTable(props: {
  suppliers: Supplier[];
  isLoading: boolean;
  onOpenCatalog: (supplier: Supplier) => void;
  onOpenEdit: (supplier: Supplier) => void;
  onDelete: (supplier: Supplier) => void;
  onRestore: (supplierId: string) => void;
}) {
  const { suppliers, isLoading, onOpenCatalog, onOpenEdit, onDelete, onRestore } = props;

  const columns = useMemo<ColumnDef<Supplier, unknown>[]>(() => [
    {
      accessorKey: "name",
      header: () => "Nombre",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: "contact_name",
      header: () => "Contacto",
      cell: ({ row }) => row.original.contact_name ?? "-",
    },
    {
      accessorKey: "email",
      header: () => "Email",
      cell: ({ row }) => row.original.email ?? "-",
    },
    {
      accessorKey: "whatsapp",
      header: () => "WhatsApp",
      cell: ({ row }) => row.original.whatsapp ? `+${normalizeWhatsappNumber(row.original.whatsapp)}` : "-",
    },
    {
      accessorKey: "is_active",
      header: () => "Estado",
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? "default" : "secondary"}>
          {row.original.is_active ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: () => "Acciones",
      cell: ({ row }) => (
        <RowActions align="start">
          <RowActionButton label="Catalogos" tone="view" onClick={() => onOpenCatalog(row.original)}>
            <Upload className="h-4 w-4" />
          </RowActionButton>
          <RowActionButton label="Editar" tone="edit" onClick={() => onOpenEdit(row.original)}>
            <Pencil className="h-4 w-4" />
          </RowActionButton>
          {row.original.is_active ? (
            <RowActionButton label="Desactivar" tone="danger" onClick={() => onDelete(row.original)}>
              <Trash2 className="h-4 w-4" />
            </RowActionButton>
          ) : (
            <RowActionButton label="Reactivar" tone="success" onClick={() => onRestore(row.original.id)}>
              <RotateCcw className="h-4 w-4" />
            </RowActionButton>
          )}
        </RowActions>
      ),
      meta: {
        className: "w-[180px]",
      },
    },
  ], [onDelete, onOpenCatalog, onOpenEdit, onRestore]);

  return (
    <div className="rounded-lg border bg-card">
      <DataTable
        columns={columns}
        data={suppliers}
        isLoading={isLoading}
        loadingMessage="Cargando..."
        emptyMessage="No se encontraron proveedores"
      />
    </div>
  );
}
