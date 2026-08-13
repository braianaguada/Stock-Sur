import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarClock, Check, Eye, Pencil, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { EntityDialog } from "@/components/common/EntityDialog";
import { RowActionButton, RowActions } from "@/components/common/RowActions";
import { MetricCard, MetricGrid, MoneyCell, PrimaryCell, StatusBadge } from "@/components/common/VisualSystem";
import { DataTable } from "@/components/data-table/DataTable";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterToolbar, PageContainer, PageHeader } from "@/components/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { STATUS_LABEL } from "@/features/documents/constants";
import { useBudgetFollowUpData, useBudgetFollowUpMutations } from "@/features/budget-follow-up/hooks";
import { buildTrackedBudgets } from "@/features/budget-follow-up/tracking";
import type { BudgetPriority, BudgetTrackingState, TrackedBudget } from "@/features/budget-follow-up/types";
import { usePaginationSlice } from "@/hooks/use-pagination-slice";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errors";
import { formatBusinessDate, formatDateTime, formatDocumentNumber, todayBusinessDateInputValue } from "@/lib/formatters";

const TRACKING_LABEL: Record<BudgetTrackingState, string> = {
  OVERDUE: "Contacto vencido",
  EXPIRED: "Presupuesto vencido",
  UPCOMING: "Próximo contacto",
  UNSCHEDULED: "Sin agenda",
  RESOLVED: "Resuelto",
};

const PRIORITY_LABEL: Record<BudgetPriority, string> = { LOW: "Baja", NORMAL: "Normal", HIGH: "Alta" };
type TrackingFilter = "ACTIONABLE" | BudgetTrackingState | "ALL";

function trackingTone(state: BudgetTrackingState) {
  if (state === "OVERDUE" || state === "EXPIRED") return "danger" as const;
  if (state === "UPCOMING") return "info" as const;
  if (state === "UNSCHEDULED") return "warning" as const;
  return "muted" as const;
}

function documentTone(status: TrackedBudget["status"]) {
  if (status === "APROBADO") return "success" as const;
  if (status === "RECHAZADO" || status === "ANULADO") return "muted" as const;
  return status === "ENVIADO" ? "info" as const : "warning" as const;
}

export default function BudgetFollowUp() {
  const { currentCompany, user, companyPermissionCodes, companyRoleCodes } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const companyId = currentCompany?.id ?? null;
  const canManage = companyPermissionCodes.includes("documents.edit") || companyRoleCodes.includes("admin");
  const { budgets, followUps, isLoading, isError, error } = useBudgetFollowUpData(companyId);
  const { saveMutation, markContactedMutation } = useBudgetFollowUpMutations(companyId, user?.id);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TrackingFilter>("ACTIONABLE");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [editing, setEditing] = useState<TrackedBudget | null>(null);
  const [priority, setPriority] = useState<BudgetPriority>("NORMAL");
  const [nextContactOn, setNextContactOn] = useState("");
  const [notes, setNotes] = useState("");
  const today = todayBusinessDateInputValue();
  const tracked = useMemo(() => buildTrackedBudgets(budgets, followUps, today), [budgets, followUps, today]);

  const filtered = useMemo(() => tracked.filter((budget) => {
    if (filter === "ACTIONABLE" && budget.trackingState === "RESOLVED") return false;
    if (filter !== "ALL" && filter !== "ACTIONABLE" && budget.trackingState !== filter) return false;
    const needle = search.trim().toLocaleLowerCase("es");
    if (!needle) return true;
    const number = formatDocumentNumber(budget.point_of_sale, budget.document_number);
    return `${number} ${budget.customer_name ?? ""}`.toLocaleLowerCase("es").includes(needle);
  }), [filter, search, tracked]);
  const pagination = usePaginationSlice({ items: filtered, page, pageSize });

  useEffect(() => setPage(1), [companyId, filter, search]);

  const openEditor = (budget: TrackedBudget) => {
    setEditing(budget);
    setPriority(budget.followUp?.priority ?? "NORMAL");
    setNextContactOn(budget.followUp?.next_contact_on ?? "");
    setNotes(budget.followUp?.notes ?? "");
  };

  const save = async () => {
    if (!editing) return;
    try {
      await saveMutation.mutateAsync({ documentId: editing.id, priority, nextContactOn: nextContactOn || null, notes: notes.trim() || null });
      toast({ title: "Seguimiento guardado", description: "La agenda comercial del presupuesto quedó actualizada." });
      setEditing(null);
    } catch (mutationError) {
      toast({ title: "No se pudo guardar", description: getErrorMessage(mutationError), variant: "destructive" });
    }
  };

  const markContacted = async (budget: TrackedBudget) => {
    try {
      await markContactedMutation.mutateAsync({ documentId: budget.id, current: budget.followUp });
      toast({ title: "Contacto registrado", description: "Se actualizó la fecha y la cantidad de contactos." });
    } catch (mutationError) {
      toast({ title: "No se pudo registrar el contacto", description: getErrorMessage(mutationError), variant: "destructive" });
    }
  };

  const columns: ColumnDef<TrackedBudget, unknown>[] = [
    {
      id: "budget",
      header: () => "Presupuesto",
      cell: ({ row }) => <PrimaryCell title={formatDocumentNumber(row.original.point_of_sale, row.original.document_number)} metadata={`Emitido ${formatBusinessDate(row.original.issue_date)}`} />,
    },
    { accessorKey: "customer_name", header: () => "Cliente", cell: ({ row }) => row.original.customer_name || "Consumidor final" },
    { accessorKey: "status", header: () => "Documento", cell: ({ row }) => <StatusBadge tone={documentTone(row.original.status)}>{STATUS_LABEL[row.original.status]}</StatusBadge>, meta: { className: "hidden lg:table-cell", cellClassName: "hidden lg:table-cell" } },
    { accessorKey: "trackingState", header: () => "Seguimiento", cell: ({ row }) => <StatusBadge tone={trackingTone(row.original.trackingState)}>{TRACKING_LABEL[row.original.trackingState]}</StatusBadge> },
    { id: "priority", header: () => "Prioridad", cell: ({ row }) => <StatusBadge tone={row.original.followUp?.priority === "HIGH" ? "danger" : row.original.followUp?.priority === "LOW" ? "muted" : "info"}>{PRIORITY_LABEL[row.original.followUp?.priority ?? "NORMAL"]}</StatusBadge>, meta: { className: "hidden xl:table-cell", cellClassName: "hidden xl:table-cell" } },
    {
      id: "agenda",
      header: () => "Agenda",
      cell: ({ row }) => <PrimaryCell title={row.original.followUp?.next_contact_on ? formatBusinessDate(row.original.followUp.next_contact_on) : "Sin fecha"} metadata={row.original.followUp?.last_contacted_at ? `Último: ${formatDateTime(row.original.followUp.last_contacted_at)} · ${row.original.followUp.contact_count} contacto(s)` : "Sin contactos registrados"} />,
      meta: { className: "hidden md:table-cell", cellClassName: "hidden md:table-cell" },
    },
    { accessorKey: "total", header: () => <span className="block text-right">Total</span>, cell: ({ row }) => <MoneyCell value={row.original.total} />, meta: { className: "hidden sm:table-cell text-right", cellClassName: "hidden sm:table-cell text-right" } },
    {
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => <RowActions>
        <RowActionButton label="Ver documentos" tone="view" onClick={() => navigate("/documents")}><Eye className="h-4 w-4" /></RowActionButton>
        {canManage ? <RowActionButton label="Editar seguimiento" tone="edit" onClick={() => openEditor(row.original)}><Pencil className="h-4 w-4" /></RowActionButton> : null}
        {canManage && row.original.trackingState !== "RESOLVED" ? <RowActionButton label="Registrar contacto" tone="success" disabled={markContactedMutation.isPending} onClick={() => void markContacted(row.original)}><Check className="h-4 w-4" /></RowActionButton> : null}
      </RowActions>,
      meta: { className: "w-[144px] text-right", cellClassName: "text-right" },
    },
  ];

  const counts = tracked.reduce<Record<BudgetTrackingState, number>>((result, budget) => {
    result[budget.trackingState] += 1;
    return result;
  }, { OVERDUE: 0, EXPIRED: 0, UPCOMING: 0, UNSCHEDULED: 0, RESOLVED: 0 });

  return <AppLayout><PageContainer archetype="analytical" className="space-y-6">
    <PageHeader eyebrow="Comercial" title="Seguimiento de presupuestos" subtitle="Priorizá contactos pendientes sin alterar el estado, stock, caja ni cuenta corriente del documento." meta={<StatusBadge tone="info">{currentCompany?.name ?? "Sin empresa"}</StatusBadge>} />
    {!companyId ? <CompanyAccessNotice /> : <>
      <MetricGrid>
        <MetricCard label="Contactos vencidos" value={counts.OVERDUE} tone={counts.OVERDUE ? "danger" : "default"} helper="Agenda anterior a hoy." />
        <MetricCard label="Presupuestos vencidos" value={counts.EXPIRED} tone={counts.EXPIRED ? "warning" : "default"} helper="Sin resolución y fuera de validez." />
        <MetricCard label="Próximos contactos" value={counts.UPCOMING} tone="info" helper="Con fecha programada." />
        <MetricCard label="Sin agenda" value={counts.UNSCHEDULED} helper="Requieren decisión comercial." />
      </MetricGrid>
      <Card>
        <CardHeader><CardTitle>Agenda comercial</CardTitle><CardDescription>Se muestran hasta 500 presupuestos recientes de la empresa activa.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <FilterToolbar>
            <div className="relative min-w-0 flex-1 sm:min-w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Buscar presupuesto o cliente" className="pl-9" placeholder="Buscar presupuesto o cliente" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
            <Select value={filter} onValueChange={(value) => setFilter(value as TrackingFilter)}><SelectTrigger aria-label="Filtrar seguimiento" className="w-full sm:w-56"><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="ACTIONABLE">Solo accionables</SelectItem><SelectItem value="OVERDUE">Contactos vencidos</SelectItem><SelectItem value="EXPIRED">Presupuestos vencidos</SelectItem><SelectItem value="UPCOMING">Próximos contactos</SelectItem><SelectItem value="UNSCHEDULED">Sin agenda</SelectItem><SelectItem value="RESOLVED">Resueltos</SelectItem><SelectItem value="ALL">Todos</SelectItem>
            </SelectContent></Select>
          </FilterToolbar>
          <div className="max-w-full overflow-x-auto rounded-xl border"><DataTable columns={columns} data={pagination.pagedItems} emptyMessage="No hay presupuestos para este filtro." isLoading={isLoading} errorMessage={isError ? getErrorMessage(error, "No se pudieron cargar los presupuestos.") : undefined} /></div>
          {!isError ? <DataTablePagination {...pagination} pageSize={pageSize} pageSizeOptions={[20, 50, 100]} onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1); }} itemLabel="presupuestos" /> : null}
        </CardContent>
      </Card>
    </>}
    <EntityDialog open={Boolean(editing)} onOpenChange={(open) => { if (!open && !saveMutation.isPending) setEditing(null); }} title="Seguimiento del presupuesto" description={editing ? `${formatDocumentNumber(editing.point_of_sale, editing.document_number)} · ${editing.customer_name || "Consumidor final"}` : undefined} footer={<><Button variant="outline" onClick={() => setEditing(null)} disabled={saveMutation.isPending}>Cancelar</Button><Button onClick={() => void save()} disabled={saveMutation.isPending}>{saveMutation.isPending ? "Guardando..." : "Guardar seguimiento"}</Button></>}>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="budget-priority">Prioridad</Label><Select value={priority} onValueChange={(value) => setPriority(value as BudgetPriority)}><SelectTrigger id="budget-priority"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PRIORITY_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="budget-next-contact">Próximo contacto</Label><Input id="budget-next-contact" type="date" value={nextContactOn} onChange={(event) => setNextContactOn(event.target.value)} /></div></div>
        <div className="space-y-2"><Label htmlFor="budget-notes">Notas comerciales</Label><Textarea id="budget-notes" maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Qué se conversó, objeciones o próximo paso..." /><p className="text-right text-xs text-muted-foreground">{notes.length}/2000</p></div>
        <div className="rounded-xl border bg-muted/35 p-3 text-sm text-muted-foreground"><CalendarClock className="mr-2 inline h-4 w-4" />Registrar un contacto actualiza el historial básico; la próxima fecha permanece hasta que la reprogrames.</div>
      </div>
    </EntityDialog>
  </PageContainer></AppLayout>;
}
