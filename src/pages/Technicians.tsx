import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page";
import { useAuth } from "@/contexts/AuthContext";
import { TechnicianFormDialog } from "@/features/technicians/components/TechnicianFormDialog";
import { useTechniciansPage } from "@/features/technicians/hooks/useTechniciansPage";
import type { Technician } from "@/features/technicians/types";
import { useToast } from "@/hooks/use-toast";

export default function TechniciansPage() {
  const { currentCompany, user } = useAuth();
  const { toast } = useToast();
  const [technicianToDelete, setTechnicianToDelete] = useState<Technician | null>(null);
  const {
    technicians,
    isLoading,
    search,
    setSearch,
    dialogOpen,
    setDialogOpen,
    editing,
    form,
    setForm,
    saveMutation,
    deleteMutation,
    openCreate,
    openEdit,
  } = useTechniciansPage({ companyId: currentCompany?.id, userId: user?.id, toast });

  return (
    <AppLayout>
      <PageHeader
        title="Tecnicos"
        description="Gestion simple de tecnicos con feedback consistente."
        actions={
          <div className="flex gap-2">
            <div className="relative max-w-sm flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Buscar por nombre, telefono o nota..." />
            </div>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo tecnico
            </Button>
          </div>
        }
      />

      <div className="rounded-xl border bg-card">
        {isLoading ? <div className="p-4 text-sm text-muted-foreground">Cargando tecnicos...</div> : null}
        {!isLoading && technicians.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No hay tecnicos cargados.</div> : null}
        {technicians.map((technician) => (
          <div key={technician.id} className="flex items-center justify-between gap-3 border-b p-3 last:border-b-0">
            <div>
              <div className="font-medium">{technician.name}</div>
              <div className="text-sm text-muted-foreground">{technician.phone ?? "Sin telefono"}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => openEdit(technician)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setTechnicianToDelete(technician)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <TechnicianFormDialog
        open={dialogOpen}
        editingTechnician={editing}
        form={form}
        isSaving={saveMutation.isPending}
        onOpenChange={setDialogOpen}
        onFormChange={setForm}
        onSubmit={() => saveMutation.mutate()}
      />
      <ConfirmDeleteDialog
        open={!!technicianToDelete}
        onOpenChange={(open) => {
          if (!open) setTechnicianToDelete(null);
        }}
        title="Eliminar tecnico"
        description={technicianToDelete ? `Esta accion eliminara a "${technicianToDelete.name}" de forma permanente.` : ""}
        isPending={deleteMutation.isPending}
        onConfirm={() => {
          if (!technicianToDelete) return;
          deleteMutation.mutate(technicianToDelete.id);
          setTechnicianToDelete(null);
        }}
      />
    </AppLayout>
  );
}
