import { ExternalLink, Eye, PackageCheck, Pencil, Plus, Search, Trash2, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { AmountDisplay, CompactBadge, MetricCard, MetricGrid, MetricHeroCard, OperationalTableShell, SectionCard } from "@/components/common/VisualSystem";
import { RowActionButton, RowActions } from "@/components/common/RowActions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FilterBar, PageHeader } from "@/components/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { TechnicianFormDialog } from "@/features/technicians/components/TechnicianFormDialog";
import { useTechnicianMaterialControl, getDefaultMaterialControlState, getRangeDates, type TechnicianMaterialControlState } from "@/features/technicians/hooks/useTechnicianMaterialControl";
import { useTechniciansPage } from "@/features/technicians/hooks/useTechniciansPage";
import type { MaterialSummaryRow, TechnicianMaterialSummary } from "@/features/technicians/materialControl";
import type { Technician } from "@/features/technicians/types";
import { useToast } from "@/hooks/use-toast";
import { formatBusinessDate } from "@/lib/formatters";

const MAIN_TABS = [
  { label: "Tecnicos", value: "technicians" },
  { label: "Control de materiales", value: "materials" },
];

const RANGE_LABELS: Record<TechnicianMaterialControlState["range"], string> = {
  today: "Hoy",
  week: "Esta semana",
  month: "Este mes",
  previousMonth: "Mes anterior",
  custom: "Personalizado",
};

function updateRange(state: TechnicianMaterialControlState, range: TechnicianMaterialControlState["range"]) {
  const dates = getRangeDates(range, state);
  return { ...state, range, ...dates };
}

function EmptyTableRow({ colSpan, children }: { colSpan: number; children: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-24 text-center text-sm text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  );
}

function MaterialRowsTable({ rows }: { rows: MaterialSummaryRow[] }) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[920px]">
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead className="text-right">Cant. entregada</TableHead>
            <TableHead className="text-right">Cant. devuelta</TableHead>
            <TableHead className="text-right">Cant. neta</TableHead>
            <TableHead className="text-right">Valor entregado</TableHead>
            <TableHead className="text-right">Valor devuelto</TableHead>
            <TableHead className="text-right">Valor neto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <EmptyTableRow colSpan={8}>No hay materiales para el periodo filtrado.</EmptyTableRow>
          ) : rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="font-medium">{row.product}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{row.sku ?? "-"}</TableCell>
              <TableCell className="text-right tabular-nums">{row.deliveredQuantity}</TableCell>
              <TableCell className="text-right tabular-nums">{row.returnedQuantity}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{row.netQuantity}</TableCell>
              <TableCell className="text-right"><AmountDisplay value={row.deliveredValue} size="sm" /></TableCell>
              <TableCell className="text-right"><AmountDisplay value={row.returnedValue} size="sm" /></TableCell>
              <TableCell className="text-right"><AmountDisplay value={row.netValue} size="sm" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function TechniciansPage() {
  const { currentCompany, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("technicians");
  const [technicianToDelete, setTechnicianToDelete] = useState<Technician | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<TechnicianMaterialSummary | null>(null);
  const [detailTab, setDetailTab] = useState("documents");
  const [controlState, setControlState] = useState<TechnicianMaterialControlState>(() => getDefaultMaterialControlState());
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

  const materialControl = useTechnicianMaterialControl({
    companyId: currentCompany?.id,
    state: controlState,
  });

  const selectedMaterials = useMemo(
    () => (selectedSummary ? materialControl.report.materialRowsByTechnician.get(selectedSummary.technicianId) ?? [] : []),
    [materialControl.report.materialRowsByTechnician, selectedSummary],
  );

  const openControlForTechnician = (technician: Technician) => {
    setControlState((current) => ({ ...current, technicianId: technician.id }));
    setActiveTab("materials");
  };

  const openDocument = (documentId: string) => navigate(`/documents?document_id=${documentId}`);
  const openService = (serviceId: string | null) => {
    if (serviceId) navigate(`/service-jobs?serviceId=${serviceId}`);
  };

  return (
    <AppLayout>
      <div className="page-shell">
        <PageHeader
          eyebrow="Servicios"
          title="Tecnicos"
          subtitle="Gestion operativa de tecnicos y control mensual de materiales asociados a remitos y devoluciones."
          tabs={MAIN_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          actions={
            activeTab === "technicians" ? (
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" /> Nuevo tecnico
              </Button>
            ) : (
              <CompactBadge tone="info">{RANGE_LABELS[controlState.range]}</CompactBadge>
            )
          }
        />

        {activeTab === "technicians" ? (
          <div className="grid gap-4">
            <FilterBar>
              <div className="relative w-full md:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Buscar por nombre, telefono o nota..." />
              </div>
            </FilterBar>

            <OperationalTableShell
              title="Tecnicos"
              description="Listado y mantenimiento de tecnicos propios."
              count={technicians.length}
            >
              <div className="overflow-x-auto">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tecnico</TableHead>
                      <TableHead>Telefono</TableHead>
                      <TableHead>Notas</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? <EmptyTableRow colSpan={4}>Cargando tecnicos...</EmptyTableRow> : null}
                    {!isLoading && technicians.length === 0 ? <EmptyTableRow colSpan={4}>No hay tecnicos cargados.</EmptyTableRow> : null}
                    {technicians.map((technician) => (
                      <TableRow key={technician.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full border bg-muted/30 text-muted-foreground">
                              <UserRound className="h-4 w-4" />
                            </span>
                            <div>
                              <div className="font-medium">{technician.name}</div>
                              <div className="text-xs text-muted-foreground">Tecnico propio</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{technician.phone ?? "Sin telefono"}</TableCell>
                        <TableCell className="max-w-md truncate text-muted-foreground">{technician.notes ?? "-"}</TableCell>
                        <TableCell className="text-right">
                          <RowActions>
                            <RowActionButton label="Ver control" tone="view" onClick={() => openControlForTechnician(technician)}>
                              <Eye className="h-4 w-4" />
                            </RowActionButton>
                            <RowActionButton label="Editar" tone="edit" onClick={() => openEdit(technician)}>
                              <Pencil className="h-4 w-4" />
                            </RowActionButton>
                            <RowActionButton label="Eliminar" tone="danger" onClick={() => setTechnicianToDelete(technician)}>
                              <Trash2 className="h-4 w-4" />
                            </RowActionButton>
                          </RowActions>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </OperationalTableShell>
          </div>
        ) : (
          <div className="grid gap-4">
            <FilterBar>
              <Select value={controlState.technicianId} onValueChange={(technicianId) => setControlState((current) => ({ ...current, technicianId }))}>
                <SelectTrigger className="w-full md:w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los tecnicos</SelectItem>
                  {materialControl.technicians.map((technician) => <SelectItem key={technician.id} value={technician.id}>{technician.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={controlState.range} onValueChange={(range) => setControlState((current) => updateRange(current, range as TechnicianMaterialControlState["range"]))}>
                <SelectTrigger className="w-full md:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="week">Esta semana</SelectItem>
                  <SelectItem value="month">Este mes</SelectItem>
                  <SelectItem value="previousMonth">Mes anterior</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
              <Input
                className="w-full md:w-40"
                type="date"
                value={controlState.dateFrom}
                disabled={controlState.range !== "custom"}
                onChange={(event) => setControlState((current) => ({ ...current, dateFrom: event.target.value }))}
              />
              <Input
                className="w-full md:w-40"
                type="date"
                value={controlState.dateTo}
                disabled={controlState.range !== "custom"}
                onChange={(event) => setControlState((current) => ({ ...current, dateTo: event.target.value }))}
              />
              <Select value={controlState.customerId} onValueChange={(customerId) => setControlState((current) => ({ ...current, customerId }))}>
                <SelectTrigger className="w-full md:w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los clientes</SelectItem>
                  {materialControl.customers.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={controlState.serviceId} onValueChange={(serviceId) => setControlState((current) => ({ ...current, serviceId }))}>
                <SelectTrigger className="w-full md:w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los trabajos</SelectItem>
                  {materialControl.services.map((service) => <SelectItem key={service.id} value={service.id}>{service.jobTitle} / {service.title}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={controlState.type} onValueChange={(type) => setControlState((current) => ({ ...current, type: type as TechnicianMaterialControlState["type"] }))}>
                <SelectTrigger className="w-full md:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="REMITO">Remitos</SelectItem>
                  <SelectItem value="REMITO_DEVOLUCION">Devoluciones</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-full md:min-w-[260px] md:flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={controlState.search}
                  onChange={(event) => setControlState((current) => ({ ...current, search: event.target.value }))}
                  className="pl-9"
                  placeholder="Remito, factura externa, cliente, tecnico o material..."
                />
              </div>
            </FilterBar>

            <MetricHeroCard
              label="Balance de materiales"
              value={materialControl.report.totals.materialBalance}
              helper={`Valor entregado menos valor devuelto entre ${formatBusinessDate(controlState.dateFrom)} y ${formatBusinessDate(controlState.dateTo)}.`}
              icon={<PackageCheck className="h-6 w-6" />}
            />
            <MetricGrid>
              <MetricCard label="Valor entregado" value={materialControl.report.totals.deliveredValue} tone="info" />
              <MetricCard label="Valor devuelto" value={materialControl.report.totals.returnedValue} tone="success" />
              <MetricCard label="Remitos" value={materialControl.report.totals.remitos} format="plain" />
              <MetricCard label="Clientes atendidos" value={materialControl.report.totals.clients} format="plain" />
            </MetricGrid>
            <MetricGrid className="xl:grid-cols-3">
              <MetricCard label="Devoluciones" value={materialControl.report.totals.devoluciones} format="plain" />
              <MetricCard label="Trabajos vinculados" value={materialControl.report.totals.jobs} format="plain" />
              <MetricCard label="Movimientos por tecnico" value={materialControl.report.movements.length} format="plain" />
            </MetricGrid>

            <OperationalTableShell
              title="Movimientos por tecnico"
              description="Resumen principal para cierre mensual por balance de materiales."
              count={materialControl.report.technicianSummaries.length}
            >
              <div className="overflow-x-auto">
                <Table className="min-w-[1040px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tecnico</TableHead>
                      <TableHead className="text-right">Remitos</TableHead>
                      <TableHead className="text-right">Devoluciones</TableHead>
                      <TableHead className="text-right">Clientes</TableHead>
                      <TableHead className="text-right">Trabajos</TableHead>
                      <TableHead className="text-right">Valor entregado</TableHead>
                      <TableHead className="text-right">Valor devuelto</TableHead>
                      <TableHead className="text-right">Balance de materiales</TableHead>
                      <TableHead className="text-right">Accion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materialControl.isLoading ? <EmptyTableRow colSpan={9}>Cargando control de materiales...</EmptyTableRow> : null}
                    {!materialControl.isLoading && materialControl.report.technicianSummaries.length === 0 ? <EmptyTableRow colSpan={9}>No hay movimientos para el periodo filtrado.</EmptyTableRow> : null}
                    {materialControl.report.technicianSummaries.map((summary) => (
                      <TableRow key={summary.technicianId}>
                        <TableCell className="font-medium">{summary.technicianName}</TableCell>
                        <TableCell className="text-right tabular-nums">{summary.remitos}</TableCell>
                        <TableCell className="text-right tabular-nums">{summary.devoluciones}</TableCell>
                        <TableCell className="text-right tabular-nums">{summary.clients}</TableCell>
                        <TableCell className="text-right tabular-nums">{summary.jobs}</TableCell>
                        <TableCell className="text-right"><AmountDisplay value={summary.deliveredValue} size="sm" /></TableCell>
                        <TableCell className="text-right"><AmountDisplay value={summary.returnedValue} size="sm" /></TableCell>
                        <TableCell className="text-right"><AmountDisplay value={summary.materialBalance} size="sm" className="font-bold" /></TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => { setSelectedSummary(summary); setDetailTab("documents"); }}>
                            Ver detalle
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </OperationalTableShell>

            <OperationalTableShell
              title="Movimientos detallados"
              description="Remitos y devoluciones vinculados a tecnicos en el rango seleccionado."
              count={materialControl.report.movements.length}
            >
              <div className="overflow-x-auto">
                <Table className="min-w-[1120px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tecnico</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Cliente / empresa</TableHead>
                      <TableHead>Trabajo / servicio</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Valor estimado</TableHead>
                      <TableHead className="text-right">Accion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materialControl.report.movements.length === 0 ? <EmptyTableRow colSpan={9}>No hay movimientos detallados para mostrar.</EmptyTableRow> : null}
                    {materialControl.report.movements.map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell>{formatBusinessDate(movement.date)}</TableCell>
                        <TableCell>{movement.technicianName}</TableCell>
                        <TableCell>
                          <div className="font-mono text-sm font-medium">{movement.documentLabel}</div>
                          {movement.externalInvoiceNumber ? <div className="text-xs text-muted-foreground">Factura externa {movement.externalInvoiceNumber}</div> : null}
                        </TableCell>
                        <TableCell>
                          <CompactBadge tone={movement.documentType === "REMITO" ? "info" : "success"}>{movement.movementType === "Entrega" ? "Entrega" : "Devolucion"}</CompactBadge>
                        </TableCell>
                        <TableCell>{movement.customerName}</TableCell>
                        <TableCell>
                          {movement.serviceLabel ? (
                            <div>
                              <div className="font-medium">{movement.jobLabel}</div>
                              <div className="text-xs text-muted-foreground">{movement.serviceLabel}</div>
                            </div>
                          ) : "Sin trabajo vinculado"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{movement.items}</TableCell>
                        <TableCell className="text-right"><AmountDisplay value={movement.estimatedValue} size="sm" /></TableCell>
                        <TableCell className="text-right">
                          <RowActions>
                            <RowActionButton label="Ver documento" tone="view" onClick={() => openDocument(movement.documentId)}>
                              <ExternalLink className="h-4 w-4" />
                            </RowActionButton>
                            {movement.serviceId ? (
                              <RowActionButton label="Ver trabajo/servicio" tone="muted" onClick={() => openService(movement.serviceId)}>
                                <Eye className="h-4 w-4" />
                              </RowActionButton>
                            ) : null}
                          </RowActions>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </OperationalTableShell>
          </div>
        )}
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
      <Dialog open={Boolean(selectedSummary)} onOpenChange={(open) => { if (!open) setSelectedSummary(null); }}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Detalle de control de materiales</DialogTitle>
            <DialogDescription>
              {selectedSummary ? `${selectedSummary.technicianName} - ${formatBusinessDate(controlState.dateFrom)} a ${formatBusinessDate(controlState.dateTo)}` : ""}
            </DialogDescription>
          </DialogHeader>
          {selectedSummary ? (
            <div className="grid gap-4">
              <MetricGrid className="xl:grid-cols-4">
                <MetricCard label="Valor entregado" value={selectedSummary.deliveredValue} tone="info" />
                <MetricCard label="Valor devuelto" value={selectedSummary.returnedValue} tone="success" />
                <MetricCard label="Balance de materiales" value={selectedSummary.materialBalance} />
                <MetricCard label="Remitos / devoluciones" value={`${selectedSummary.remitos} / ${selectedSummary.devoluciones}`} />
              </MetricGrid>
              <div className="grid gap-3 md:grid-cols-3">
                <SectionCard className="p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">Clientes atendidos</p><p className="mt-1 text-2xl font-bold">{selectedSummary.clients}</p></SectionCard>
                <SectionCard className="p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">Trabajos vinculados</p><p className="mt-1 text-2xl font-bold">{selectedSummary.jobs}</p></SectionCard>
                <SectionCard className="p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">Movimientos</p><p className="mt-1 text-2xl font-bold">{selectedSummary.movements.length}</p></SectionCard>
              </div>
              <Tabs value={detailTab} onValueChange={setDetailTab}>
                <TabsList>
                  <TabsTrigger value="documents">Documentos</TabsTrigger>
                  <TabsTrigger value="materials">Materiales</TabsTrigger>
                </TabsList>
                <TabsContent value="documents">
                  <div className="overflow-x-auto rounded-lg border">
                    <Table className="min-w-[980px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Documento</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Trabajo / servicio</TableHead>
                          <TableHead className="text-right">Items</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="text-right">Accion</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedSummary.movements.map((movement) => (
                          <TableRow key={movement.id}>
                            <TableCell>{formatBusinessDate(movement.date)}</TableCell>
                            <TableCell>
                              <div className="font-mono text-sm font-medium">{movement.documentLabel}</div>
                              {movement.originDocumentId ? <div className="text-xs text-muted-foreground">Origen vinculado</div> : null}
                            </TableCell>
                            <TableCell>{movement.movementType === "Entrega" ? "Entrega" : "Devolucion"}</TableCell>
                            <TableCell>{movement.customerName}</TableCell>
                            <TableCell>{movement.serviceLabel ? `${movement.jobLabel} / ${movement.serviceLabel}` : "Sin trabajo vinculado"}</TableCell>
                            <TableCell className="text-right">{movement.items}</TableCell>
                            <TableCell className="text-right"><AmountDisplay value={movement.estimatedValue} size="sm" /></TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant="outline" onClick={() => openDocument(movement.documentId)}>Ver documento</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
                <TabsContent value="materials">
                  <MaterialRowsTable rows={selectedMaterials} />
                </TabsContent>
              </Tabs>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
