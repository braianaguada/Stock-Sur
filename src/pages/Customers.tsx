import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteByStrategy } from "@/lib/deleteStrategy";
import { getErrorMessage } from "@/lib/errors";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Customer } from "@/features/customers/types";
import { DataCard, FilterBar, PageHeader } from "@/components/ui/page";

export default function CustomersPage() {
  const { currentCompany, user } = useAuth();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: "", cuit: "", email: "", phone: "", is_occasional: false });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", currentCompany?.id ?? "no-company", deferredSearch],
    enabled: Boolean(currentCompany?.id),
    queryFn: async () => {
      let q = supabase.from("customers").select("*").eq("company_id", currentCompany!.id).order("name");
      if (deferredSearch) q = q.or(`name.ilike.%${deferredSearch}%,cuit.ilike.%${deferredSearch}%`);
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return data as Customer[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        company_id: currentCompany!.id,
        name: form.name,
        cuit: form.cuit || null,
        email: form.email || null,
        phone: form.phone || null,
        is_occasional: form.is_occasional,
        created_by: user?.id ?? null,
      };

      if (editing) {
        const { error } = await supabase.from("customers").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setDialogOpen(false);
      toast({ title: editing ? "Cliente actualizado" : "Cliente creado" });
    },
    onError: (e: unknown) =>
      toast({
        title: "Error",
        description: getErrorMessage(e),
        variant: "destructive",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteByStrategy({ table: "customers", id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast({ title: "Cliente eliminado" });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", cuit: "", email: "", phone: "", is_occasional: false });
    setDialogOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditing(customer);
    setForm({
      name: customer.name,
      cuit: customer.cuit ?? "",
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      is_occasional: customer.is_occasional,
    });
    setDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="page-shell">
        {!currentCompany ? (
          <div className="surface-card-muted max-w-2xl px-5 py-4 text-sm text-foreground">
            Seleccioná una empresa para gestionar sus clientes.
          </div>
        ) : null}

        <PageHeader
          eyebrow="Base comercial"
          title="Clientes"
          description="Gestión de clientes con una lectura más limpia para escritorio, manteniendo intactas altas, edición y borrado."
          actions={(
            <Button onClick={openCreate} disabled={!currentCompany}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo cliente
            </Button>
          )}
        />

        <FilterBar>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nombre o CUIT..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </FilterBar>

        <DataCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>CUIT</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="w-[96px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : customers.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No se encontraron clientes</TableCell></TableRow>
              ) : customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>{customer.cuit ?? "—"}</TableCell>
                  <TableCell>{customer.email ?? "—"}</TableCell>
                  <TableCell>{customer.phone ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={customer.is_occasional ? "secondary" : "default"}>
                      {customer.is_occasional ? "Ocasional" : "Regular"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => openEdit(customer)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => setCustomerToDelete(customer)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataCard>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar cliente" : "Nuevo cliente"}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>CUIT</Label>
                <Input value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="occasional" checked={form.is_occasional} onChange={(e) => setForm({ ...form, is_occasional: e.target.checked })} className="rounded" />
              <Label htmlFor="occasional">Cliente ocasional</Label>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Guardando..." : "Guardar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!customerToDelete}
        onOpenChange={(open) => {
          if (!open) setCustomerToDelete(null);
        }}
        title="Eliminar cliente"
        description={customerToDelete ? `Esta acción eliminará a "${customerToDelete.name}" de forma permanente.` : ""}
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (!customerToDelete) return;
          deleteMutation.mutate(customerToDelete.id);
          setCustomerToDelete(null);
        }}
      />
    </AppLayout>
  );
}
