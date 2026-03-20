import { Pencil, RotateCcw, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>WhatsApp</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-[180px]">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                Cargando...
              </TableCell>
            </TableRow>
          ) : suppliers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                No se encontraron proveedores
              </TableCell>
            </TableRow>
          ) : (
            suppliers.map((supplier) => (
              <TableRow key={supplier.id}>
                <TableCell className="font-medium">{supplier.name}</TableCell>
                <TableCell>{supplier.contact_name ?? "-"}</TableCell>
                <TableCell>{supplier.email ?? "-"}</TableCell>
                <TableCell>{supplier.whatsapp ? `+${normalizeWhatsappNumber(supplier.whatsapp)}` : "-"}</TableCell>
                <TableCell>
                  <Badge variant={supplier.is_active ? "default" : "secondary"}>
                    {supplier.is_active ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onOpenCatalog(supplier)} title="Catalogos">
                      <Upload className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onOpenEdit(supplier)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {supplier.is_active ? (
                      <Button variant="ghost" size="icon" onClick={() => onDelete(supplier)} title="Desactivar">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" onClick={() => onRestore(supplier.id)} title="Reactivar">
                        <RotateCcw className="h-4 w-4 text-emerald-600" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
