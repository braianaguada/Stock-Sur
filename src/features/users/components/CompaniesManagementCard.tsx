import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Power, RotateCcw } from "lucide-react";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { DataTable } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getErrorMessage } from "@/lib/errors";
import { CountBadge, PrimaryCell, StatusBadge } from "@/components/common/VisualSystem";
import { RowActionButton, RowActions } from "@/components/common/RowActions";
import { normalizeCompanyIdentity, normalizeCompanySlug } from "@/features/users/utils";

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
      const companyIdentity = normalizeCompanyIdentity({ name, slug });
      const { error } = await supabase
        .from("companies")
        .update(companyIdentity)
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
      cell: ({ row }) => <PrimaryCell title={row.original.name} metadata={row.original.slug} />,
    },
    {
      accessorKey: "status",
      header: () => "Estado",
      cell: ({ row }) => <StatusBadge tone={row.original.status === "ACTIVE" ? "success" : "muted"}>{row.original.status === "ACTIVE" ? "Activa" : "Inactiva"}</StatusBadge>,
      meta: { className: "w-[120px]" },
    },
    {
      id: "actions",
      header: () => <div className="text-right">Acciones</div>,
      cell: ({ row }) => (
        <RowActions>
          <RowActionButton label={`Editar ${row.original.name}`} tone="edit" onClick={() => setEditingCompany(row.original)}>
            <Pencil className="h-4 w-4" />
          </RowActionButton>
          {row.original.status === "ACTIVE" ? (
            <RowActionButton label={`Desactivar ${row.original.name}`} tone="danger" onClick={() => setCompanyToDeactivate(row.original)}>
              <Power className="h-4 w-4" />
            </RowActionButton>
          ) : (
            <RowActionButton label={`Reactivar ${row.original.name}`} tone="success" onClick={() => statusMutation.mutate({ id: row.original.id, status: "ACTIVE" })}>
              <RotateCcw className="h-4 w-4" />
            </RowActionButton>
          )}
        </RowActions>
      ),
      meta: { className: "w-[112px]" },
    },
  ], [statusMutation]);

  return (
    <>
      <Card className="min-w-0 border-border/70 shadow-none">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Empresas</CardTitle>
            <CardDescription>Editar identidad operativa o desactivar empresas sin borrar su historial.</CardDescription>
          </div>
          <CountBadge>{companiesQuery.data?.length ?? 0} {(companiesQuery.data?.length ?? 0) === 1 ? "empresa" : "empresas"}</CountBadge>
        </CardHeader>
        <CardContent className="p-0">
        <DataTable
          columns={columns}
          data={companiesQuery.data ?? []}
          isLoading={companiesQuery.isLoading}
          loadingMessage="Cargando empresas..."
          emptyMessage={companiesQuery.error ? getErrorMessage(companiesQuery.error) : "No hay empresas creadas."}
        />
        </CardContent>
      </Card>

      <Dialog open={Boolean(editingCompany)} onOpenChange={(open) => !open && setEditingCompany(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar empresa</DialogTitle>
            <DialogDescription>Los cambios se reflejan en los selectores y accesos de usuarios.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="edit-company-name">Nombre</Label><Input id="edit-company-name" value={name} onChange={(event) => setName(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="edit-company-slug">Identificador</Label><Input id="edit-company-slug" value={slug} onChange={(event) => setSlug(normalizeCompanySlug(event.target.value))} /></div>
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
