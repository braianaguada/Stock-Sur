import { useDeferredValue, useMemo, useState } from "react";
import { Edit, Eye, Plus, Search, Trash2, Wrench } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterBar, PageHeader, StatCard } from "@/components/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useServiceJobs } from "@/features/service-jobs/hooks/useServiceJobs";
import { DEFAULT_JOB_FORM, DEFAULT_SERVICE_FORM } from "@/features/service-jobs/lib/serviceJobForm";
import { SERVICE_JOB_PRIORITIES, SERVICE_JOB_STATUSES, SERVICE_STATUSES } from "@/features/service-jobs/types";
import type { ServiceForm, ServiceJobForm, ServiceJobListItem, ServiceRow, ServiceWithTechnicians } from "@/features/service-jobs/types";

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

function JobStatusBadge({ status }: { status: ServiceJobListItem["status"] }) {
  const className = {
    OPEN: "border-sky-500/30 bg-sky-500/10 text-sky-400",
    IN_PROGRESS: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    ON_HOLD: "border-slate-500/30 bg-slate-500/10 text-slate-400",
    DONE: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    CANCELLED: "border-rose-500/30 bg-rose-500/10 text-rose-400",
  }[status];
  return <Badge variant="outline" className={className}>{JOB_STATUS_LABEL[status]}</Badge>;
}

export default function ServiceJobsPage() {
  const { currentCompany, user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [status, setStatus] = useState("ALL");
  const [technicianId, setTechnicianId] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<ServiceJobListItem | null>(null);
  const [editingService, setEditingService] = useState<ServiceWithTechnicians | null>(null);
  const [jobToDelete, setJobToDelete] = useState<ServiceJobListItem | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<ServiceRow | null>(null);
  const [jobForm, setJobForm] = useState<ServiceJobForm>(DEFAULT_JOB_FORM);
  const [serviceForm, setServiceForm] = useState<ServiceForm>(DEFAULT_SERVICE_FORM);

  const {
    customers,
    technicians,
    jobs,
    servicesByJobId,
    isLoading,
    saveJobMutation,
    deleteJobMutation,
    saveServiceMutation,
    deleteServiceMutation,
  } = useServiceJobs({
    companyId: currentCompany?.id ?? null,
    userId: user?.id,
    search: deferredSearch,
    status,
    technicianId,
    from,
    to,
    toast,
  });

  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId) ?? jobs[0] ?? null, [jobs, selectedJobId]);
  const selectedServices = selectedJob ? servicesByJobId.get(selectedJob.id) ?? [] : [];

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
      <div className="page-shell">
        {!currentCompany ? <CompanyAccessNotice description="Necesitas una empresa activa para gestionar trabajos y servicios." /> : null}

        <PageHeader
          eyebrow="Trabajos"
          title="Trabajos y servicios"
          subtitle="Base operativa para registrar casos de clientes, servicios internos y tecnicos asignados sin tocar materiales ni remitos."
          actions={<Button onClick={openCreateJob}><Plus className="mr-2 h-4 w-4" /> Nuevo trabajo</Button>}
        />

        <div className="grid gap-3 md:grid-cols-3">
          <StatCard label="Trabajos visibles" value={jobs.length} icon={<Wrench className="h-5 w-5" />} />
          <StatCard label="Servicios" value={jobs.reduce((sum, job) => sum + job.serviceCount, 0)} tone="info" />
          <StatCard label="Tecnicos asociados" value={new Set(jobs.flatMap((job) => job.technicianNames)).size} tone="success" />
        </div>

        <FilterBar>
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por trabajo o cliente..." className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full md:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los estados</SelectItem>
              {SERVICE_JOB_STATUSES.map((value) => <SelectItem key={value} value={value}>{JOB_STATUS_LABEL[value]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={technicianId} onValueChange={setTechnicianId}>
            <SelectTrigger className="w-full md:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los tecnicos</SelectItem>
              {technicians.map((technician) => <SelectItem key={technician.id} value={technician.id}>{technician.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input className="w-full md:w-40" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <Input className="w-full md:w-40" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </FilterBar>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <section className="data-panel overflow-hidden">
            {isLoading ? (
              <div className="grid gap-3 p-6">
                <div className="h-5 w-48 animate-pulse rounded bg-muted" />
                <div className="h-24 animate-pulse rounded-lg border bg-muted/30" />
                <div className="h-24 animate-pulse rounded-lg border bg-muted/30" />
              </div>
            ) : jobs.length === 0 ? (
              <Card className="m-4 border-dashed bg-muted/15">
                <CardContent className="flex items-center justify-between gap-3 p-6">
                  <div>
                    <h3 className="font-semibold">Todavia no hay trabajos</h3>
                    <p className="text-sm text-muted-foreground">Crea el primer trabajo para empezar a cargar servicios internos.</p>
                  </div>
                  <Button onClick={openCreateJob}><Plus className="mr-2 h-4 w-4" /> Nuevo</Button>
                </CardContent>
              </Card>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trabajo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Prioridad</TableHead>
                    <TableHead>Servicios</TableHead>
                    <TableHead>Tecnicos</TableHead>
                    <TableHead>Actualizado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id} className={cn("cursor-pointer", selectedJob?.id === job.id && "bg-muted/40")} onClick={() => setSelectedJobId(job.id)}>
                      <TableCell>
                        <div className="font-medium">{job.title}</div>
                        <div className="text-xs text-muted-foreground">Abierto {formatDateTime(job.opened_at)}</div>
                      </TableCell>
                      <TableCell>{job.customers?.name ?? "Sin cliente"}</TableCell>
                      <TableCell><JobStatusBadge status={job.status} /></TableCell>
                      <TableCell>{PRIORITY_LABEL[job.priority ?? "NORMAL"]}</TableCell>
                      <TableCell>{job.serviceCount}</TableCell>
                      <TableCell className="max-w-48 truncate">{job.technicianNames.join(", ") || "Sin tecnico"}</TableCell>
                      <TableCell>{formatDateTime(job.updated_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" title="Ver detalle" onClick={(event) => { event.stopPropagation(); setSelectedJobId(job.id); }}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" title="Editar" onClick={(event) => { event.stopPropagation(); openEditJob(job); }}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" title="Eliminar" className="text-destructive hover:text-destructive" onClick={(event) => { event.stopPropagation(); setJobToDelete(job); }}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>

          <aside className="data-panel p-4">
            {selectedJob ? (
              <div className="grid gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="page-eyebrow">Detalle</p>
                    <h2 className="text-2xl font-bold tracking-tight">{selectedJob.title}</h2>
                    <p className="text-sm text-muted-foreground">{selectedJob.customers?.name ?? "Sin cliente asociado"}</p>
                  </div>
                  <JobStatusBadge status={selectedJob.status} />
                </div>
                <p className="rounded-xl border bg-muted/20 p-3 text-sm text-muted-foreground">{selectedJob.description || "Sin descripcion cargada."}</p>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Servicios</h3>
                  <Button size="sm" onClick={openCreateService}><Plus className="mr-2 h-4 w-4" /> Agregar servicio</Button>
                </div>
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
                        <Badge variant="outline">{SERVICE_STATUS_LABEL[service.status]}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{service.description || "Sin descripcion."}</p>
                      <p className="mt-2 text-xs text-muted-foreground">Tecnicos: {service.technicianNames.join(", ") || "sin asignar"}</p>
                      <div className="mt-3 flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditService(service)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setServiceToDelete(service)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Selecciona un trabajo para ver sus servicios.</div>
            )}
          </aside>
        </div>
      </div>

      <Dialog open={jobDialogOpen} onOpenChange={setJobDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingJob ? "Editar trabajo" : "Nuevo trabajo"}</DialogTitle>
            <DialogDescription>Datos generales del caso. Los materiales se vincularan por remitos en una fase posterior.</DialogDescription>
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
            <DialogDescription>Intervencion concreta dentro del trabajo. No incluye productos ni materiales en esta fase.</DialogDescription>
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
                if (!selectedJob) return;
                saveServiceMutation.mutate({ form: serviceForm, serviceId: editingService?.id, jobId: selectedJob.id }, { onSuccess: () => setServiceDialogOpen(false) });
              }}
              disabled={saveServiceMutation.isPending || !selectedJob}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={Boolean(jobToDelete)}
        onOpenChange={(open) => { if (!open) setJobToDelete(null); }}
        title="Eliminar trabajo"
        description={jobToDelete ? `Se eliminara "${jobToDelete.title}" con sus servicios asociados.` : ""}
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
    </AppLayout>
  );
}
