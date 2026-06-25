import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Power, RotateCcw } from "lucide-react";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { TableBadge } from "@/components/common/TableBadge";
import { DataTable } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataCard } from "@/components/ui/page";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/errors";

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "INACTIVE";
};

export function CompaniesManagementCard() {
  const queryClient = useQueryClient();
  const [editingCompany, setEditingCompany] = useState<CompanyRow | null>(null);
  const [companyToDeactivate, setCompanyToDeactivate] = useState<CompanyRow | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const companiesQuery = useQuery({
    queryKey: ["users-companies-management"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id,name,slug,status").order("name");
      if (error) throw error;
      return (data ?? []) as CompanyRow[];
    },
  });

  useEffect(() => {
    setName(editingCompany?.name ?? "");
    setSlug(editingCompany?.slug ?? "");
  }, [editingCompany]);

  const refreshCompanies = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["users-companies-management"] }),
      queryClient.invalidateQueries({ queryKey: ["users-company-options"] }),
    ]);
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingCompany) return;
      const { error } = await supabase
        .from("companies")
        .update({ name: name.trim(), slug: slug.trim() })
        .eq("id", editingCompany.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshCompanies();
      setEditingCompany(null);
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CompanyRow["status"] }) => {
      const { error } = await supabase.from("companies").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshCompanies();
      setCompanyToDeactivate(null);
    },
  });

  const columns = useMemo<ColumnDef<CompanyRow, unknown>[]>(() => [
    {
      accessorKey: "name",
      header: () => "Empresa",
      cell: ({ row }) => <div className="min-w-0"><p className="truncate font-medium">{row.original.name}</p><p className="truncate text-xs text-muted-foreground">{row.original.slug}</p></div>,
    },
    {
      accessorKey: "status",
      header: () => "Estado",
      cell: ({ row }) => <TableBadge tone={row.original.status === "ACTIVE" ? "success" : "neutral"}>{row.original.status === "ACTIVE" ? "Activa" : "Inactiva"}</TableBadge>,
      meta: { className: "w-[120px]" },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Acciones</div>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditingCompany(row.original)}>
            <Pencil className="mr-2 h-4 w-4" /> Editar
          </Button>
          {row.original.status === "ACTIVE" ? (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setCompanyToDeactivate(row.original)}>
              <Power className="mr-2 h-4 w-4" /> Desactivar
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => statusMutation.mutate({ id: row.original.id, status: "ACTIVE" })}>
              <RotateCcw className="mr-2 h-4 w-4" /> Reactivar
            </Button>
          )}
        </div>
      ),
      meta: { className: "w-[260px]" },
    },
  ], [statusMutation]);

  return (
    <>
      <DataCard>
        <div className="border-b border-border/60 px-4 py-4 sm:px-5">
          <h2 className="font-semibold">Empresas</h2>
          <p className="mt-1 text-sm text-muted-foreground">Editar nombres e identificadores, o desactivar empresas sin borrar su historial.</p>
        </div>
        <DataTable
          columns={columns}
          data={companiesQuery.data ?? []}
          isLoading={companiesQuery.isLoading}
          loadingMessage="Cargando empresas..."
          emptyMessage={companiesQuery.error ? getErrorMessage(companiesQuery.error) : "No hay empresas creadas."}
        />
      </DataCard>

      <Dialog open={Boolean(editingCompany)} onOpenChange={(open) => !open && setEditingCompany(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar empresa</DialogTitle>
            <DialogDescription>Los cambios se reflejan en los selectores y accesos de usuarios.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="edit-company-name">Nombre</Label><Input id="edit-company-name" value={name} onChange={(event) => setName(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="edit-company-slug">Identificador</Label><Input id="edit-company-slug" value={slug} onChange={(event) => setSlug(event.target.value)} /></div>
            {updateMutation.error ? <p className="text-sm text-destructive">{getErrorMessage(updateMutation.error)}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCompany(null)}>Cancelar</Button>
            <Button disabled={!name.trim() || !slug.trim() || updateMutation.isPending} onClick={() => updateMutation.mutate()}>
              {updateMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(companyToDeactivate)}
        onOpenChange={(open) => !open && setCompanyToDeactivate(null)}
        title="Desactivar empresa"
        description={companyToDeactivate ? `La empresa "${companyToDeactivate.name}" dejará de estar disponible para operar, sin perder sus datos.` : ""}
        isPending={statusMutation.isPending}
        onConfirm={() => companyToDeactivate && statusMutation.mutate({ id: companyToDeactivate.id, status: "INACTIVE" })}
      />
    </>
  );
}
