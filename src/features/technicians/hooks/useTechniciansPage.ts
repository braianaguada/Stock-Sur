import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/errors";
import { invalidateTechnicianQueries } from "@/lib/invalidate";
import type { Technician } from "../types";
import type { TechnicianFormState } from "../components/TechnicianFormDialog";
import { hasTechnicianHistory, TECHNICIAN_DELETE_BLOCKED_MESSAGE, type TechnicianHistoryCounts } from "../technicianLifecycle";

type ToastFn = (options: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
export type TechnicianStatusFilter = "active" | "inactive" | "all";

const EMPTY_FORM: TechnicianFormState = { name: "", phone: "", notes: "", is_active: true };

async function getTechnicianHistoryCounts(id: string): Promise<TechnicianHistoryCounts> {
  const [{ count: documents, error: documentsError }, { count: serviceAssignments, error: serviceAssignmentsError }] = await Promise.all([
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("technician_id", id),
    supabase.from("service_job_service_technicians").select("id", { count: "exact", head: true }).eq("technician_id", id),
  ]);

  if (documentsError) throw documentsError;
  if (serviceAssignmentsError) throw serviceAssignmentsError;

  return {
    documents: documents ?? 0,
    serviceAssignments: serviceAssignments ?? 0,
  };
}

type UseTechniciansPageOptions = {
  companyId: string | null | undefined;
  userId: string | null | undefined;
  toast: ToastFn;
};

export function useTechniciansPage({ companyId, userId, toast }: UseTechniciansPageOptions) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Technician | null>(null);
  const [form, setForm] = useState<TechnicianFormState>(EMPTY_FORM);
  const [statusFilter, setStatusFilter] = useState<TechnicianStatusFilter>("active");
  const qc = useQueryClient();
  const techniciansQuery = useQuery({
    queryKey: ["technicians", companyId, deferredSearch, statusFilter],
    enabled: Boolean(companyId),
    queryFn: async () => {
      let q = supabase.from("technicians").select("*").eq("company_id", companyId!).order("name");
      if (deferredSearch) q = q.or(`name.ilike.%${deferredSearch}%,phone.ilike.%${deferredSearch}%,notes.ilike.%${deferredSearch}%`);
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return ((data ?? []) as Technician[])
        .map((technician) => ({ ...technician, is_active: technician.is_active ?? true }))
        .filter((technician) => {
          if (statusFilter === "all") return true;
          return statusFilter === "active" ? technician.is_active !== false : technician.is_active === false;
        })
        .sort((a, b) => Number(b.is_active !== false) - Number(a.is_active !== false) || a.name.localeCompare(b.name));
    },
  });
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { company_id: companyId!, name: form.name, phone: form.phone || null, notes: form.notes || null, is_active: form.is_active, created_by: userId ?? null };
      const q = editing ? supabase.from("technicians").update(payload).eq("id", editing.id) : supabase.from("technicians").insert(payload);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: async () => { await invalidateTechnicianQueries(qc); setDialogOpen(false); setEditing(null); setForm(EMPTY_FORM); toast({ title: editing ? "Tecnico actualizado" : "Tecnico creado" }); },
    onError: (error) => toast({ title: "No se pudo guardar", description: getErrorMessage(error), variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const counts = await getTechnicianHistoryCounts(id);
      if (hasTechnicianHistory(counts)) {
        throw new Error(TECHNICIAN_DELETE_BLOCKED_MESSAGE);
      }
      const { error } = await supabase.from("technicians").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidateTechnicianQueries(qc);
      toast({ title: "Tecnico eliminado" });
    },
    onError: (error) => toast({ title: "No se pudo eliminar", description: getErrorMessage(error), variant: "destructive" }),
  });
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from("technicians").update({ is_active: isActive }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async (_, variables) => {
      await invalidateTechnicianQueries(qc);
      toast({ title: variables.isActive ? "Tecnico activado" : "Tecnico marcado como inactivo" });
    },
    onError: (error) => toast({ title: "No se pudo cambiar el estado", description: getErrorMessage(error), variant: "destructive" }),
  });
  return { technicians: techniciansQuery.data ?? [], isLoading: techniciansQuery.isLoading, search, setSearch, statusFilter, setStatusFilter, dialogOpen, setDialogOpen, editing, setEditing, form, setForm, saveMutation, deleteMutation, toggleActiveMutation, openCreate: () => { setEditing(null); setForm(EMPTY_FORM); setDialogOpen(true); }, openEdit: (t: Technician) => { setEditing(t); setForm({ name: t.name, phone: t.phone ?? "", notes: t.notes ?? "", is_active: t.is_active ?? true }); setDialogOpen(true); } };
}
