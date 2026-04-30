import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { TechnicianFormDialog } from "@/features/technicians/components/TechnicianFormDialog";
import type { Technician } from "@/features/technicians/types";

type FormState = { name: string; phone: string; notes: string };
const EMPTY_FORM: FormState = { name: "", phone: "", notes: "" };

export default function TechniciansPage() {
  const { currentCompany, user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Technician | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [items, setItems] = useState<Technician[]>([]);

  const load = useCallback(async () => {
    if (!currentCompany?.id) return;
    let q = supabase.from("technicians").select("id,name,phone,notes,created_at").eq("company_id", currentCompany.id).order("name");
    if (search.trim()) q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    const { data, error } = await q;
    if (error) throw error;
    setItems((data ?? []) as Technician[]);
  }, [currentCompany?.id, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!currentCompany?.id) return;
    const payload = { company_id: currentCompany.id, name: form.name, phone: form.phone || null, notes: form.notes || null, created_by: user?.id ?? null };
    const q = editing ? supabase.from("technicians").update(payload).eq("id", editing.id) : supabase.from("technicians").insert(payload);
    const { error } = await q;
    if (error) throw error;
    await qc.invalidateQueries();
    setDialogOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    await load();
  };

  return (
    <AppLayout>
      <PageHeader
        title="Tecnicos"
        description="CRUD basico"
        actions={
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Buscar tecnico" />
            </div>
            <Button onClick={() => { setEditing(null); setForm(EMPTY_FORM); setDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />Nuevo
            </Button>
          </div>
        }
      />
      <div className="rounded-xl border bg-card">
        {items.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 border-b p-3 last:border-b-0">
            <div>
              <div className="font-medium">{t.name}</div>
              <div className="text-sm text-muted-foreground">{t.phone ?? "Sin telefono"}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => { setEditing(t); setForm({ name: t.name, phone: t.phone ?? "", notes: t.notes ?? "" }); setDialogOpen(true); }}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={async () => { await supabase.from("technicians").delete().eq("id", t.id); void load(); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <TechnicianFormDialog open={dialogOpen} editingTechnician={editing} form={form} isSaving={false} onOpenChange={setDialogOpen} onFormChange={setForm} onSubmit={() => { void save().catch((error) => toast({ title: "Error", description: String(error), variant: "destructive" })); }} />
    </AppLayout>
  );
}
