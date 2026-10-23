import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, MoreHorizontal, Pencil, RotateCcw, Trash2, Upload } from "lucide-react";
import { RowActionButton, RowActions } from "@/components/common/RowActions";
import { CountBadge, PrimaryCell } from "@/components/common/VisualSystem";
import { EntityDialog } from "@/components/common/EntityDialog";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeWhatsappNumber } from "@/lib/whatsapp";
import type { Supplier } from "@/features/suppliers/types";

export function SuppliersTable(props: {
  suppliers: Supplier[];
  isLoading: boolean;
  onOpenCatalog: (supplier: Supplier) => void;
  onUpload: (supplier: Supplier) => void;
  onOpenEdit: (supplier: Supplier) => void;
  onDelete: (supplier: Supplier) => void;
  onRestore: (supplierId: string) => void;
}) {
  const { suppliers, isLoading, onOpenCatalog, onUpload, onOpenEdit, onDelete, onRestore } = props;

  const [actionSupplier, setActionSupplier] = useState<Supplier | null>(null);

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
      id: "actions",
      header: () => "Acciones",
      cell: ({ row }) => (
        <RowActions align="start">
          <RowActionButton label="Ver listas" tone="view" onClick={() => onOpenCatalog(row.original)}>
            <Eye className="h-4 w-4" />
          </RowActionButton>
          <RowActionButton label="Subir lista" disabled={!row.original.is_active} onClick={() => onUpload(row.original)}>
            <Upload className="h-4 w-4" />
          </RowActionButton>
          <RowActionButton label="Más acciones del proveedor" onClick={() => setActionSupplier(row.original)}><MoreHorizontal className="h-4 w-4" /></RowActionButton>
        </RowActions>
      ),
      meta: {
        className: "w-[148px] text-right",
        cellClassName: "text-right",
      },
    },
  ], [onOpenCatalog, onUpload]);

  return (
    <><Card className="min-w-0 border-border/70 shadow-none">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>Directorio de proveedores</CardTitle>
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
    <EntityDialog open={Boolean(actionSupplier)} onOpenChange={(open) => { if (!open) setActionSupplier(null); }} title={actionSupplier?.name ?? "Proveedor"} description="Configuración y disponibilidad del proveedor.">
      <div className="flex flex-col gap-2">
        <Button variant="outline" onClick={() => { if (actionSupplier) onOpenEdit(actionSupplier); setActionSupplier(null); }}><Pencil className="mr-2 h-4 w-4" />Editar proveedor</Button>
        {actionSupplier?.is_active ? <Button variant="outline" className="text-destructive" onClick={() => { onDelete(actionSupplier); setActionSupplier(null); }}><Trash2 className="mr-2 h-4 w-4" />Desactivar proveedor</Button> : <Button variant="outline" onClick={() => { if (actionSupplier) onRestore(actionSupplier.id); setActionSupplier(null); }}><RotateCcw className="mr-2 h-4 w-4" />Reactivar proveedor</Button>}
      </div>
    </EntityDialog></>
  );
}
