import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Archive, CheckCircle2, ClipboardList, Edit, ExternalLink, Eye, FilePlus2, Link2, PackageCheck, Plus, RotateCcw, Search, Trash2, Unlink, Wrench } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { RowActionButton, RowActions } from "@/components/common/RowActions";
import { CountBadge, InfoBadge, MetricCard, MetricGrid, StatusBadge } from "@/components/common/VisualSystem";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterToolbar, PageContainer, PageHeader } from "@/components/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyBrand } from "@/contexts/company-brand-context";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useServiceJobs } from "@/features/service-jobs/hooks/useServiceJobs";
import { isServiceJobArchived } from "@/features/service-jobs/lib/serviceJobLifecycle";
import { getServiceJobOperationalStats } from "@/features/service-jobs/lib/operationalSummary";
import { DEFAULT_JOB_FORM, DEFAULT_SERVICE_FORM } from "@/features/service-jobs/lib/serviceJobForm";
import { getServiceRemitoTechnicianWarning, isLinkableRemitoForService, summarizeServiceRemitos } from "@/features/service-jobs/lib/serviceRemitos";
import { SERVICE_JOB_PRIORITIES, SERVICE_JOB_STATUSES, SERVICE_STATUSES } from "@/features/service-jobs/types";
import type { LinkableMaterialRemito, ServiceForm, ServiceJobForm, ServiceJobListItem, ServiceRow, ServiceWithTechnicians } from "@/features/service-jobs/types";
import { formatNumber } from "@/features/documents/utils";

const JOB_STATUS_LABEL = {
  OPEN: "Abierto",
  IN_PROGRESS: "En curso",
  ON_HOLD: "Pausado",
  DONE: "Terminado",
  CANCELLED: "Cancelado",
} as const;

const SERVICE_STATUS_LABEL = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En curso",
  DONE: "Terminado",
  CANCELLED: "Cancelado",
} as const;

const PRIORITY_LABEL = {
  LOW: "Baja",
  NORMAL: "Normal",
  HIGH: "Alta",
  URGENT: "Urgente",
} as const;

function toDateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function formatMoney(value: number | string | null | undefined) {
  return `$${(Number(value) || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function JobStatusBadge({ status }: { status: ServiceJobListItem["status"] }) {
  const tone = {
    OPEN: "info",
    IN_PROGRESS: "warning",
    ON_HOLD: "muted",
    DONE: "success",
    CANCELLED: "danger",
  } as const satisfies Record<ServiceJobListItem["status"], "info" | "warning" | "muted" | "success" | "danger">;
  const statusTone = tone[status];
  return <StatusBadge tone={statusTone}>{JOB_STATUS_LABEL[status]}</StatusBadge>;
}

export default function ServiceJobsPage() {
  const { currentCompany, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { settings: companySettings } = useCompanyBrand();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [status, setStatus] = useState("ALL");
  const [priority, setPriority] = useState("ALL");
  const [archivedFilter, setArchivedFilter] = useState<"active" | "archived" | "all">("active");
  const [technicianId, setTechnicianId] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<ServiceJobListItem | null>(null);
  const [editingService, setEditingService] = useState<ServiceWithTechnicians | null>(null);
  const [jobToDelete, setJobToDelete] = useState<ServiceJobListItem | null>(null);
  const [jobToArchive, setJobToArchive] = useState<ServiceJobListItem | null>(null);
  const [jobToRestore, setJobToRestore] = useState<ServiceJobListItem | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<ServiceRow | null>(null);
  const [linkingService, setLinkingService] = useState<ServiceWithTechnicians | null>(null);
  const [remitoSearch, setRemitoSearch] = useState("");
  const [jobForm, setJobForm] = useState<ServiceJobForm>(DEFAULT_JOB_FORM);
  const [serviceForm, setServiceForm] = useState<ServiceForm>(DEFAULT_SERVICE_FORM);

  const {
    customers,
    technicians,
    jobs,
    servicesByJobId,
    linkableRemitos,
    isLoading,
    saveJobMutation,
    archiveJobMutation,
    restoreJobMutation,
    deleteJobMutation,
    saveServiceMutation,
    deleteServiceMutation,
    createMaterialRemitoMutation,
    linkMaterialRemitoMutation,
    unlinkMaterialRemitoMutation,
  } = useServiceJobs({
    companyId: currentCompany?.id ?? null,
    userId: user?.id,
    search: deferredSearch,
    status,
    priority,
    archived: archivedFilter,
    technicianId,
    from,
    to,
    toast,
  });

  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null, [jobs, selectedJobId]);
  const selectedServices = useMemo(
    () => (selectedJob ? servicesByJobId.get(selectedJob.id) ?? [] : []),
    [selectedJob, servicesByJobId],
  );
  const operationalStats = useMemo(() => getServiceJobOperationalStats(jobs, servicesByJobId), [jobs, servicesByJobId]);
  const selectedRemitoSummary = useMemo(
    () => summarizeServiceRemitos(selectedServices.flatMap((service) => service.materialRemitos)),
    [selectedServices],
  );
  const serviceIdParam = searchParams.get("serviceId");

  useEffect(() => {
    if (!serviceIdParam) return;
    for (const [jobId, services] of servicesByJobId.entries()) {
      if (services.some((service) => service.id === serviceIdParam)) {
        setSelectedJobId(jobId);
        return;
      }
    }
  }, [serviceIdParam, servicesByJobId]);

  const techniciansById = useMemo(
    () => new Map(technicians.map((technician) => [technician.id, technician])),
    [technicians],
  );

  const selectedJobCustomer = selectedJob?.customer_id
    ? customers.find((customer) => customer.id === selectedJob.customer_id) ?? null
    : null;
  const selectedJobArchived = selectedJob ? isServiceJobArchived(selectedJob) : false;
  const selectedJobHasRegisteredCustomer = Boolean(selectedJobCustomer?.id);
  const hasActiveFilters = Boolean(
    search.trim() || status !== "ALL" || priority !== "ALL" || archivedFilter !== "active" || technicianId !== "ALL" || from || to,
  );

  const clearFilters = () => {
    setSearch("");
    setStatus("ALL");
    setPriority("ALL");
    setArchivedFilter("active");
    setTechnicianId("ALL");
    setFrom("");
    setTo("");
  };

  const filteredLinkableRemitos = useMemo(() => {
    if (!linkingService || !selectedJob) return [];
    const query = remitoSearch.trim().toLowerCase();
    return linkableRemitos
      .filter((remito) =>
        isLinkableRemitoForService(remito, { serviceId: linkingService.id, customerId: selectedJob.customer_id }),
      )
      .filter((remito) => {
        if (!query) return true;
        return [
          formatNumber(remito.document_number, remito.point_of_sale),
          remito.customer_name ?? "",
          remito.status,
          techniciansById.get(remito.technician_id ?? "")?.name ?? "",
        ].join(" ").toLowerCase().includes(query);
      })
      .slice(0, 50);
  }, [linkableRemitos, linkingService, remitoSearch, selectedJob, techniciansById]);

  const openDocument = (documentId: string) => {
    navigate(`/documents?document_id=${documentId}`);
  };

  const openCreateJob = () => {
    setEditingJob(null);
    setJobForm(DEFAULT_JOB_FORM);
    setJobDialogOpen(true);
  };

  const openEditJob = (job: ServiceJobListItem) => {
    setEditingJob(job);
    setJobForm({
      title: job.title,
      customer_id: job.customer_id ?? "",
      description: job.description ?? "",
      status: job.status,
      priority: job.priority ?? "NORMAL",
    });
    setJobDialogOpen(true);
  };

  const openCreateService = () => {
    setEditingService(null);
    setServiceForm(DEFAULT_SERVICE_FORM);
    setServiceDialogOpen(true);
  };

  const openEditService = (service: ServiceWithTechnicians) => {
    setEditingService(service);
    setServiceForm({
      title: service.title,
      description: service.description ?? "",
      scheduled_at: toDateTimeInput(service.scheduled_at),
      status: service.status,
      technician_ids: service.technicianIds,
      tasks_performed: service.tasks_performed ?? "",
      notes: service.notes ?? "",
    });
    setServiceDialogOpen(true);
  };

  const toggleTechnician = (id: string, checked: boolean) => {
    setServiceForm((current) => ({
      ...current,
      technician_ids: checked ? [...current.technician_ids, id] : current.technician_ids.filter((value) => value !== id),
    }));
  };

  return (
    <AppLayout>
      <PageContainer archetype="workspace" className="page-shell">
        {!currentCompany ? <CompanyAccessNotice description="Necesitas una empresa activa para gestionar trabajos y servicios." /> : null}

        <PageHeader
          eyebrow="Trabajos"
          title="Trabajos y servicios"
          subtitle="Base operativa para registrar casos de clientes, servicios internos, tecnicos asignados y remitos de materiales vinculados."
          actions={<Button onClick={openCreateJob}><Plus className="mr-2 h-4 w-4" /> Nuevo trabajo</Button>}
        />

        <MetricGrid>
          <MetricCard label="Trabajos abiertos" value={operationalStats.openJobs} format="plain" helper={`${operationalStats.inProgressJobs} en curso`} icon={<Wrench className="h-5 w-5" />} />
          <MetricCard label="Servicios pendientes" value={operationalStats.pendingServices} format="plain" helper={`${operationalStats.doneServices} realizados`} tone="warning" icon={<ClipboardList className="h-5 w-5" />} />
          <MetricCard label="Trabajos finalizados" value={operationalStats.doneJobs} format="plain" tone="success" icon={<CheckCircle2 className="h-5 w-5" />} />
          <MetricCard label="Costo est. materiales" value={formatMoney(operationalStats.estimatedMaterialCost)} format="plain" tone="info" icon={<PackageCheck className="h-5 w-5" />} />
        </MetricGrid>

        <FilterToolbar>
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Buscar trabajos" placeholder="Buscar por trabajo o cliente..." className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <Select value={archivedFilter} onValueChange={(value) => setArchivedFilter(value as "active" | "archived" | "all")}>
            <SelectTrigger aria-label="Visibilidad" className="w-full md:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="archived">Archivados</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="Estado" className="w-full md:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los estados</SelectItem>
              {SERVICE_JOB_STATUSES.map((value) => <SelectItem key={value} value={value}>{JOB_STATUS_LABEL[value]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={technicianId} onValueChange={setTechnicianId}>
            <SelectTrigger aria-label="Técnico" className="w-full md:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los tecnicos</SelectItem>
              {technicians.map((technician) => <SelectItem key={technician.id} value={technician.id}>{technician.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger aria-label="Prioridad" className="w-full md:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas las prioridades</SelectItem>
              {SERVICE_JOB_PRIORITIES.map((value) => <SelectItem key={value} value={value}>{PRIORITY_LABEL[value]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input aria-label="Desde" className="w-full md:w-40" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <Input aria-label="Hasta" className="w-full md:w-40" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          {hasActiveFilters ? <Button type="button" variant="ghost" onClick={clearFilters}>Limpiar filtros</Button> : null}
        </FilterToolbar>

        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <Card className="min-w-0 border-border/70 shadow-none">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div><CardTitle>Bandeja de trabajos</CardTitle><CardDescription>Seleccioná un trabajo para consultar y operar sus servicios.</CardDescription></div>
              <CountBadge>{jobs.length} {jobs.length === 1 ? "registro" : "registros"}</CountBadge>
            </CardHeader>
            <CardContent>
            {isLoading ? (
              <div className="grid gap-3 py-2" aria-label="Cargando trabajos">
                <div className="h-5 w-48 animate-pulse rounded bg-muted" />
                <div className="h-24 animate-pulse rounded-lg border bg-muted/30" />
                <div className="h-24 animate-pulse rounded-lg border bg-muted/30" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-dashed bg-muted/15 p-6 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="font-semibold">{hasActiveFilters ? "No hay trabajos que coincidan" : "Todavía no hay trabajos"}</h3>
                    <p className="text-sm text-muted-foreground">
                      {hasActiveFilters ? "Probá con otros criterios o restablecé la vista activa." : "Creá el primer trabajo para empezar a cargar servicios internos."}
                    </p>
                  </div>
                  {hasActiveFilters ? <Button variant="outline" onClick={clearFilters}>Limpiar filtros</Button> : <Button onClick={openCreateJob}><Plus className="mr-2 h-4 w-4" /> Nuevo</Button>}
              </div>
            ) : (
              <>
              <div className="grid gap-3 md:hidden" data-testid="service-job-mobile-list">
                {jobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    aria-pressed={selectedJob?.id === job.id}
                    onClick={() => setSelectedJobId(job.id)}
                    className={cn("min-w-0 w-full rounded-xl border p-4 text-left transition-colors", selectedJob?.id === job.id ? "border-primary/35 bg-primary/5" : "bg-card hover:bg-muted/30")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{job.title}</p>
                        <p className="truncate text-sm text-muted-foreground">{job.customers?.name ?? "Sin cliente"}</p>
                      </div>
                      <JobStatusBadge status={job.status} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span>{job.serviceCount} servicios · {job.pendingServiceCount} pendientes</span>
                      <span className="text-right">{job.remitoCount} remitos</span>
                      <span>{PRIORITY_LABEL[job.priority ?? "NORMAL"]}</span>
                      <span className="truncate text-right">{job.technicianNames.join(", ") || "Sin técnico"}</span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
              <Table className="min-w-[840px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Trabajo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Operación</TableHead>
                    <TableHead>Técnicos</TableHead>
                    <TableHead>Última actividad</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id} className={cn("cursor-pointer", selectedJob?.id === job.id && "bg-muted/40")} onClick={() => setSelectedJobId(job.id)}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{job.title}</div>
                          {job.archived_at ? <InfoBadge>Archivado</InfoBadge> : null}
                        </div>
                        <div className="text-xs text-muted-foreground">Abierto {formatDateTime(job.opened_at)}</div>
                      </TableCell>
                      <TableCell>{job.customers?.name ?? "Sin cliente"}</TableCell>
                      <TableCell><JobStatusBadge status={job.status} /></TableCell>
                      <TableCell>
                        <div className="font-medium">{job.serviceCount} servicios · {job.remitoCount} remitos</div>
                        <div className="text-xs text-muted-foreground">{job.pendingServiceCount} pendientes · {PRIORITY_LABEL[job.priority ?? "NORMAL"]} · {formatMoney(job.estimatedMaterialCost)}</div>
                      </TableCell>
                      <TableCell className="max-w-48 truncate">{job.technicianNames.join(", ") || "Sin técnico"}</TableCell>
                      <TableCell>{formatDateTime(job.lastActivityAt ?? job.updated_at)}</TableCell>
                      <TableCell className="text-right">
                        <RowActions>
                          <RowActionButton label="Ver detalle" tone="view" onClick={(event) => { event.stopPropagation(); setSelectedJobId(job.id); }}><Eye className="h-4 w-4" /></RowActionButton>
                          <RowActionButton label="Editar" tone="edit" onClick={(event) => { event.stopPropagation(); openEditJob(job); }}><Edit className="h-4 w-4" /></RowActionButton>
                          {job.archived_at ? (
                            <RowActionButton label="Restaurar" tone="success" onClick={(event) => { event.stopPropagation(); setJobToRestore(job); }}><RotateCcw className="h-4 w-4" /></RowActionButton>
                          ) : (
                            <RowActionButton label="Archivar" tone="warning" onClick={(event) => { event.stopPropagation(); setJobToArchive(job); }}><Archive className="h-4 w-4" /></RowActionButton>
                          )}
                          {job.canDelete ? (
                            <RowActionButton label="Eliminar" tone="danger" onClick={(event) => { event.stopPropagation(); setJobToDelete(job); }}><Trash2 className="h-4 w-4" /></RowActionButton>
                          ) : (
                            <TooltipProvider>
                              <Tooltip delayDuration={200}>
                                <TooltipTrigger asChild>
                                  <span onClick={(event) => event.stopPropagation()}>
                                    <RowActionButton label={job.deleteBlockedReason ?? "No se puede eliminar"} tone="muted" disabled><Trash2 className="h-4 w-4" /></RowActionButton>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>{job.deleteBlockedReason}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </RowActions>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
              </>
            )}
            </CardContent>
          </Card>

          <Card className="min-w-0 self-start border-border/70 shadow-none xl:sticky xl:top-4">
            <CardContent className="p-4">
            {selectedJob ? (
              <div className="grid gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="page-eyebrow">Detalle</p>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold tracking-tight">{selectedJob.title}</h2>
                      {selectedJobArchived ? <InfoBadge>Archivado</InfoBadge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">{selectedJob.customers?.name ?? "Sin cliente asociado"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <JobStatusBadge status={selectedJob.status} />
                    {selectedJobArchived ? (
                      <Button size="sm" variant="outline" onClick={() => setJobToRestore(selectedJob)}>
                        <RotateCcw className="mr-2 h-4 w-4" /> Restaurar
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setJobToArchive(selectedJob)}>
                        <Archive className="mr-2 h-4 w-4" /> Archivar
                      </Button>
                    )}
                  </div>
                </div>
                <p className="rounded-xl border bg-muted/20 p-3 text-sm text-muted-foreground">{selectedJob.description || "Sin descripcion cargada."}</p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border bg-muted/15 p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Servicios</p>
                    <p className="mt-1 text-xl font-bold">{selectedServices.length}</p>
                  </div>
                  <div className="rounded-xl border bg-muted/15 p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Remitos</p>
                    <p className="mt-1 text-xl font-bold">{selectedRemitoSummary.documents}</p>
                  </div>
                  <div className="rounded-xl border bg-muted/15 p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Total remitos</p>
                    <p className="mt-1 text-xl font-bold">{formatMoney(selectedRemitoSummary.total)}</p>
                  </div>
                  <div className="rounded-xl border bg-muted/15 p-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Costo estimado</p>
                    <p className="mt-1 text-xl font-bold">{formatMoney(selectedRemitoSummary.estimatedCost)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Servicios</h3>
                  <Button size="sm" onClick={openCreateService} disabled={selectedJobArchived}><Plus className="mr-2 h-4 w-4" /> Agregar servicio</Button>
                </div>
                {selectedJobArchived ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                    Este trabajo esta archivado. Podes restaurarlo para volver a operar sobre sus servicios.
                  </div>
                ) : null}
                <div className="grid gap-3">
                  {selectedServices.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Este trabajo todavia no tiene servicios.</div>
                  ) : selectedServices.map((service) => (
                    <div key={service.id} className="rounded-xl border bg-card/70 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">{service.title}</div>
                          <div className="text-xs text-muted-foreground">{service.scheduled_at ? formatDateTime(service.scheduled_at) : "Sin fecha programada"}</div>
                        </div>
                        <StatusBadge tone={service.status === "DONE" ? "success" : service.status === "CANCELLED" ? "danger" : service.status === "IN_PROGRESS" ? "warning" : "info"}>{SERVICE_STATUS_LABEL[service.status]}</StatusBadge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{service.description || "Sin descripcion."}</p>
                      <p className="mt-2 text-xs text-muted-foreground">Tecnicos: {service.technicianNames.join(", ") || "sin asignar"}</p>
                      <div className="mt-3 rounded-xl border bg-muted/10 p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold">Remitos de materiales</p>
                            <p className="text-xs text-muted-foreground">
                              {(() => {
                                const summary = summarizeServiceRemitos(service.materialRemitos);
                                return `${summary.documents} remito(s), ${summary.lineCount} linea(s), total ${formatMoney(summary.total)}, costo est. ${formatMoney(summary.estimatedCost)}`;
                              })()}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                createMaterialRemitoMutation.mutate(
                                  {
                                    service,
                                    customer: selectedJobCustomer,
                                    pointOfSale: companySettings.default_point_of_sale ?? 1,
                                  },
                                  { onSuccess: openDocument },
                                )
                              }
                              disabled={createMaterialRemitoMutation.isPending || selectedJobArchived || !selectedJobHasRegisteredCustomer}
                              title={selectedJobHasRegisteredCustomer ? undefined : "El trabajo necesita un cliente registrado para crear remitos"}
                            >
                              <FilePlus2 className="mr-2 h-4 w-4" /> Crear remito
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setLinkingService(service); setRemitoSearch(""); }}
                              disabled={selectedJobArchived || !selectedJobHasRegisteredCustomer}
                              title={selectedJobHasRegisteredCustomer ? undefined : "El trabajo necesita un cliente registrado para vincular remitos"}
                            >
                              <Link2 className="mr-2 h-4 w-4" /> Vincular existente
                            </Button>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2">
                          {service.materialRemitos.length === 0 ? (
                            <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">Sin remitos vinculados.</div>
                          ) : service.materialRemitos.map((remito) => {
                            const warning = getServiceRemitoTechnicianWarning({
                              serviceTechnicianIds: service.technicianIds,
                              documentTechnicianId: remito.technician_id,
                            });
                            return (
                              <div key={remito.id} className="rounded-lg border bg-card p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="font-mono text-sm font-semibold">{formatNumber(remito.document_number, remito.point_of_sale)}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {remito.status} - {formatDateTime(remito.issue_date)} - {techniciansById.get(remito.technician_id ?? "")?.name ?? "Sin tecnico"} - {remito.lineCount} linea(s) - {formatMoney(remito.total)}
                                    </p>
                                    {warning ? <p className="mt-1 text-xs text-amber-600">{warning}</p> : null}
                                  </div>
                                  <RowActions className="shrink-0">
                                    <RowActionButton label="Ver documento" tone="view" onClick={() => openDocument(remito.id)}><ExternalLink className="h-4 w-4" /></RowActionButton>
                                    <RowActionButton label="Desvincular" tone="muted" onClick={() => unlinkMaterialRemitoMutation.mutate(remito.id)}><Unlink className="h-4 w-4" /></RowActionButton>
                                  </RowActions>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <RowActions className="mt-3">
                        <RowActionButton label="Editar servicio" tone="edit" onClick={() => openEditService(service)} disabled={selectedJobArchived}><Edit className="h-4 w-4" /></RowActionButton>
                        <RowActionButton label="Eliminar servicio" tone="danger" onClick={() => setServiceToDelete(service)} disabled={selectedJobArchived}><Trash2 className="h-4 w-4" /></RowActionButton>
                      </RowActions>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Selecciona un trabajo para ver sus servicios.</div>
            )}
            </CardContent>
          </Card>
        </div>
      </PageContainer>

      <Dialog open={jobDialogOpen} onOpenChange={setJobDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingJob ? "Editar trabajo" : "Nuevo trabajo"}</DialogTitle>
            <DialogDescription>Datos generales del caso. Los materiales se controlan desde remitos vinculados a sus servicios.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1"><Label>Titulo</Label><Input value={jobForm.title} onChange={(event) => setJobForm((current) => ({ ...current, title: event.target.value }))} /></div>
            <div className="space-y-1">
              <Label>Cliente</Label>
              <Select value={jobForm.customer_id || "NONE"} onValueChange={(value) => setJobForm((current) => ({ ...current, customer_id: value === "NONE" ? "" : value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Sin cliente</SelectItem>
                  {customers.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1"><Label>Estado</Label><Select value={jobForm.status} onValueChange={(value) => setJobForm((current) => ({ ...current, status: value as ServiceJobForm["status"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SERVICE_JOB_STATUSES.map((value) => <SelectItem key={value} value={value}>{JOB_STATUS_LABEL[value]}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Prioridad</Label><Select value={jobForm.priority} onValueChange={(value) => setJobForm((current) => ({ ...current, priority: value as ServiceJobForm["priority"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SERVICE_JOB_PRIORITIES.map((value) => <SelectItem key={value} value={value}>{PRIORITY_LABEL[value]}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-1"><Label>Descripcion</Label><Textarea value={jobForm.description} onChange={(event) => setJobForm((current) => ({ ...current, description: event.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJobDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveJobMutation.mutate({ form: jobForm, jobId: editingJob?.id }, { onSuccess: () => setJobDialogOpen(false) })} disabled={saveJobMutation.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingService ? "Editar servicio" : "Agregar servicio"}</DialogTitle>
            <DialogDescription>Intervencion concreta dentro del trabajo, con tecnicos asignados y remitos de materiales asociados.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1"><Label>Titulo</Label><Input value={serviceForm.title} onChange={(event) => setServiceForm((current) => ({ ...current, title: event.target.value }))} /></div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1"><Label>Fecha/hora programada</Label><Input type="datetime-local" value={serviceForm.scheduled_at} onChange={(event) => setServiceForm((current) => ({ ...current, scheduled_at: event.target.value }))} /></div>
              <div className="space-y-1"><Label>Estado</Label><Select value={serviceForm.status} onValueChange={(value) => setServiceForm((current) => ({ ...current, status: value as ServiceForm["status"] }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SERVICE_STATUSES.map((value) => <SelectItem key={value} value={value}>{SERVICE_STATUS_LABEL[value]}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-1"><Label>Descripcion</Label><Textarea value={serviceForm.description} onChange={(event) => setServiceForm((current) => ({ ...current, description: event.target.value }))} /></div>
            <div className="space-y-2">
              <Label>Tecnicos asignados</Label>
              <div className="grid max-h-44 gap-2 overflow-y-auto rounded-xl border p-3 md:grid-cols-2">
                {technicians.length === 0 ? <p className="text-sm text-muted-foreground">No hay tecnicos cargados.</p> : technicians.map((technician) => (
                  <label key={technician.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={serviceForm.technician_ids.includes(technician.id)} onCheckedChange={(checked) => toggleTechnician(technician.id, checked === true)} />
                    {technician.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1"><Label>Tareas realizadas</Label><Textarea value={serviceForm.tasks_performed} onChange={(event) => setServiceForm((current) => ({ ...current, tasks_performed: event.target.value }))} /></div>
            <div className="space-y-1"><Label>Notas</Label><Textarea value={serviceForm.notes} onChange={(event) => setServiceForm((current) => ({ ...current, notes: event.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServiceDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!selectedJob || selectedJobArchived) return;
                saveServiceMutation.mutate({ form: serviceForm, serviceId: editingService?.id, jobId: selectedJob.id }, { onSuccess: () => setServiceDialogOpen(false) });
              }}
              disabled={saveServiceMutation.isPending || !selectedJob || selectedJobArchived}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(jobToArchive)}
        onOpenChange={(open) => { if (!open) setJobToArchive(null); }}
        title="Archivar trabajo"
        description={jobToArchive ? `Este trabajo dejara de aparecer en la vista principal, pero no se borrara su historial.\n\nTrabajo: "${jobToArchive.title}".` : ""}
        confirmLabel={archiveJobMutation.isPending ? "Archivando..." : "Archivar"}
        isPending={archiveJobMutation.isPending}
        onConfirm={() => { if (jobToArchive) archiveJobMutation.mutate(jobToArchive.id); setJobToArchive(null); }}
      />
      <ConfirmDeleteDialog
        open={Boolean(jobToRestore)}
        onOpenChange={(open) => { if (!open) setJobToRestore(null); }}
        title="Restaurar trabajo"
        description={jobToRestore ? `El trabajo "${jobToRestore.title}" volvera a la vista activa y podra operarse normalmente.` : ""}
        confirmLabel={restoreJobMutation.isPending ? "Restaurando..." : "Restaurar"}
        isPending={restoreJobMutation.isPending}
        onConfirm={() => { if (jobToRestore) restoreJobMutation.mutate(jobToRestore.id); setJobToRestore(null); }}
      />
      <ConfirmDeleteDialog
        open={Boolean(jobToDelete)}
        onOpenChange={(open) => { if (!open) setJobToDelete(null); }}
        title="Eliminar trabajo"
        description={jobToDelete ? `Se eliminara definitivamente "${jobToDelete.title}". Solo se permite porque no tiene servicios ni historial operativo asociado.` : ""}
        isPending={deleteJobMutation.isPending}
        onConfirm={() => { if (jobToDelete) deleteJobMutation.mutate(jobToDelete.id); setJobToDelete(null); }}
      />
      <ConfirmDeleteDialog
        open={Boolean(serviceToDelete)}
        onOpenChange={(open) => { if (!open) setServiceToDelete(null); }}
        title="Eliminar servicio"
        description={serviceToDelete ? `Se eliminara "${serviceToDelete.title}".` : ""}
        isPending={deleteServiceMutation.isPending}
        onConfirm={() => { if (serviceToDelete) deleteServiceMutation.mutate(serviceToDelete.id); setServiceToDelete(null); }}
      />
      <Dialog open={Boolean(linkingService)} onOpenChange={(open) => { if (!open) setLinkingService(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Vincular remito existente</DialogTitle>
            <DialogDescription>Selecciona un remito actual de Documentos. No se crean movimientos ni se modifica stock.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Input
              value={remitoSearch}
              onChange={(event) => setRemitoSearch(event.target.value)}
              placeholder="Buscar por numero, cliente, estado o tecnico..."
            />
            <div className="max-h-[420px] overflow-y-auto rounded-xl border">
              {filteredLinkableRemitos.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No hay remitos compatibles para mostrar.</div>
              ) : filteredLinkableRemitos.map((remito: LinkableMaterialRemito) => {
                const warning = linkingService ? getServiceRemitoTechnicianWarning({
                  serviceTechnicianIds: linkingService.technicianIds,
                  documentTechnicianId: remito.technician_id,
                }) : null;
                return (
                  <div key={remito.id} className="flex flex-col gap-3 border-b p-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold">{formatNumber(remito.document_number, remito.point_of_sale)}</p>
                      <p className="text-xs text-muted-foreground">
                        {remito.status} - {formatDateTime(remito.issue_date)} - {remito.customer_name ?? "Sin cliente"} - {techniciansById.get(remito.technician_id ?? "")?.name ?? "Sin tecnico"} - {formatMoney(remito.total)}
                      </p>
                      {warning ? <p className="mt-1 text-xs text-amber-600">{warning}</p> : null}
                      {remito.service_id === linkingService?.id ? <InfoBadge className="mt-2">Ya vinculado</InfoBadge> : null}
                    </div>
                    <Button
                      size="sm"
                      disabled={!linkingService || remito.service_id === linkingService?.id || linkMaterialRemitoMutation.isPending}
                      onClick={() => {
                        if (!linkingService) return;
                        linkMaterialRemitoMutation.mutate(
                          { documentId: remito.id, serviceId: linkingService.id, customerId: selectedJob?.customer_id ?? "" },
                          { onSuccess: () => setLinkingService(null) },
                        );
                      }}
                    >
                      Vincular
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkingService(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
