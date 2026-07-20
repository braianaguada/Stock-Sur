import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, RotateCcw, Trash2, Upload } from "lucide-react";
import { RowActionButton, RowActions } from "@/components/common/RowActions";
import { CountBadge, PrimaryCell, StatusBadge } from "@/components/common/VisualSystem";
import { DataTable } from "@/components/data-table/DataTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      header: () => "Proveedor",
      cell: ({ row }) => <PrimaryCell title={row.original.name} metadata={row.original.contact_name ?? "Sin contacto asignado"} />,
    },
    {
      accessorKey: "contact_name",
      header: () => "Contacto",
      cell: ({ row }) => row.original.contact_name ?? "-",
      meta: { className: "hidden lg:table-cell", cellClassName: "hidden lg:table-cell" },
    },
    {
      accessorKey: "email",
      header: () => "Email",
      cell: ({ row }) => row.original.email ?? "-",
      meta: { className: "hidden md:table-cell", cellClassName: "hidden md:table-cell" },
    },
    {
      accessorKey: "whatsapp",
      header: () => "WhatsApp",
      cell: ({ row }) => row.original.whatsapp ? `+${normalizeWhatsappNumber(row.original.whatsapp)}` : "-",
      meta: { className: "hidden xl:table-cell", cellClassName: "hidden xl:table-cell" },
    },
    {
      accessorKey: "is_active",
      header: () => "Estado",
      cell: ({ row }) => (
        <StatusBadge tone={row.original.is_active ? "success" : "muted"}>
          {row.original.is_active ? "Activo" : "Inactivo"}
        </StatusBadge>
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
        className: "w-[148px] text-right",
        cellClassName: "text-right",
      },
    },
  ], [onDelete, onOpenCatalog, onOpenEdit, onRestore]);

  return (
    <Card className="min-w-0 border-border/70 shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>Directorio de proveedores</CardTitle>
          <CardDescription>Contactos y acceso a sus catálogos vigentes.</CardDescription>
        </div>
        <CountBadge>{suppliers.length} {suppliers.length === 1 ? "registro" : "registros"}</CountBadge>
      </CardHeader>
      <CardContent className="p-0">
        <DataTable
          columns={columns}
          data={suppliers}
          isLoading={isLoading}
          loadingMessage="Cargando proveedores..."
          emptyMessage="No hay proveedores que coincidan con los filtros."
        />
      </CardContent>
    </Card>
  );
}
