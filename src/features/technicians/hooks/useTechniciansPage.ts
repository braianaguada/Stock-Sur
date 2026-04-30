import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/errors";
import type { Technician } from "../types";
import type { TechnicianFormState } from "../components/TechnicianFormDialog";

type ToastFn = (options: { title: string; description?: string; variant?: "default" | "destructive" }) => void;

const EMPTY_FORM: TechnicianFormState = { name: "", phone: "", notes: "" };

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
  const qc = useQueryClient();
  const techniciansQuery = useQuery({
    queryKey: ["technicians", companyId, deferredSearch],
    enabled: Boolean(companyId),
    queryFn: async () => {
      let q = supabase.from("technicians").select("*").eq("company_id", companyId!).order("name");
      if (deferredSearch) q = q.or(`name.ilike.%${deferredSearch}%,phone.ilike.%${deferredSearch}%`);
      const { data, error } = await q.limit(200);
      if (error) throw error;
      return (data ?? []) as Technician[];
    },
  });
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { company_id: companyId!, name: form.name, phone: form.phone || null, notes: form.notes || null, created_by: userId ?? null };
      const q = editing ? supabase.from("technicians").update(payload).eq("id", editing.id) : supabase.from("technicians").insert(payload);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["technicians"] }); setDialogOpen(false); setEditing(null); setForm(EMPTY_FORM); },
    onError: (error) => toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" }),
  });
  return { technicians: techniciansQuery.data ?? [], isLoading: techniciansQuery.isLoading, search, setSearch, dialogOpen, setDialogOpen, editing, setEditing, form, setForm, saveMutation, openCreate: () => { setEditing(null); setForm(EMPTY_FORM); setDialogOpen(true); }, openEdit: (t: Technician) => { setEditing(t); setForm({ name: t.name, phone: t.phone ?? "", notes: t.notes ?? "" }); setDialogOpen(true); } };
}
