import { ExternalLink, Eye, PackageCheck, Pencil, Plus, Power, Printer, Search, Trash2, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { AppLayout } from "@/components/AppLayout";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { AmountDisplay, CountBadge, InfoBadge, MetricCard, MetricGrid, PrimaryCell, StatusBadge } from "@/components/common/VisualSystem";
import { RowActionButton, RowActions } from "@/components/common/RowActions";
import { DataTable } from "@/components/data-table/DataTable";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FilterToolbar, PageContainer, PageHeader } from "@/components/ui/page";
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
import { usePaginationSlice } from "@/hooks/use-pagination-slice";

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
      <Table className="min-w-[1180px]">
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
            <TableHead className="text-right">Costo neto</TableHead>
            <TableHead className="text-right">Margen estimado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <EmptyTableRow colSpan={10}>No hay materiales para el periodo filtrado.</EmptyTableRow>
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
              <TableCell className="text-right"><AmountDisplay value={row.netCost} size="sm" /></TableCell>
              <TableCell className="text-right"><AmountDisplay value={row.grossMargin} size="sm" /></TableCell>
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [technicianToDelete, setTechnicianToDelete] = useState<Technician | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<TechnicianMaterialSummary | null>(null);
  const [detailTab, setDetailTab] = useState("documents");
  const [printMode, setPrintMode] = useState(false);
  const [controlState, setControlState] = useState<TechnicianMaterialControlState>(() => getDefaultMaterialControlState());
  const {
    technicians,
    isLoading,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    dialogOpen,
    setDialogOpen,
    editing,
    form,
    setForm,
    saveMutation,
    deleteMutation,
    toggleActiveMutation,
    openCreate,
    openEdit,
  } = useTechniciansPage({ companyId: currentCompany?.id, userId: user?.id, toast });
  const pagination = usePaginationSlice({ items: technicians, page, pageSize });

  useEffect(() => setPage(1), [search, statusFilter, currentCompany?.id]);

  const materialControl = useTechnicianMaterialControl({
    companyId: currentCompany?.id,
    state: controlState,
  });

  const selectedMaterials = useMemo(
    () => (selectedSummary ? materialControl.report.materialRowsByTechnician.get(selectedSummary.technicianId) ?? [] : []),
    [materialControl.report.materialRowsByTechnician, selectedSummary],
  );
  const selectedTechnicianName = controlState.technicianId === "ALL"
    ? "Todos los tecnicos"
    : materialControl.technicians.find((technician) => technician.id === controlState.technicianId)?.name ?? "Tecnico seleccionado";
  const selectedCustomerName = controlState.customerId === "ALL"
    ? "Todos los clientes"
    : materialControl.customers.find((customer) => customer.id === controlState.customerId)?.name ?? "Cliente seleccionado";
  const selectedServiceName = controlState.serviceId === "ALL"
    ? "Todos los trabajos"
    : materialControl.services.find((service) => service.id === controlState.serviceId)?.title ?? "Trabajo seleccionado";
  const generatedAt = useMemo(() => new Date().toLocaleString("es-AR"), []);

  useEffect(() => {
    const handleAfterPrint = () => setPrintMode(false);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  const openControlForTechnician = (technician: Technician) => {
    setControlState((current) => ({ ...current, technicianId: technician.id }));
    setActiveTab("materials");
  };

  const openDocument = (documentId: string) => navigate(`/documents?document_id=${documentId}`);
  const openService = (serviceId: string | null) => {
    if (serviceId) navigate(`/service-jobs?serviceId=${serviceId}`);
  };
  const printMovements = () => {
    setPrintMode(true);
    window.setTimeout(() => window.print(), 0);
  };
  const handleRangeChange = (range: TechnicianMaterialControlState["range"]) => {
    setControlState((current) => (range === "custom" ? { ...current, range } : updateRange(current, range)));
  };
  const handleDateFromChange = (dateFrom: string) => {
    setControlState((current) => ({ ...current, dateFrom, dateTo: current.dateTo && dateFrom > current.dateTo ? dateFrom : current.dateTo }));
  };
  const handleDateToChange = (dateTo: string) => {
    setControlState((current) => ({ ...current, dateFrom: current.dateFrom && dateTo < current.dateFrom ? dateTo : current.dateFrom, dateTo }));
  };
  const technicianColumns: ColumnDef<Technician, unknown>[] = [
    {
      accessorKey: "name",
      header: "Tecnico",
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-muted/30 text-muted-foreground" aria-hidden="true">
            <UserRound className="h-4 w-4" />
          </span>
          <PrimaryCell title={row.original.name} metadata="Tecnico propio" />
        </div>
      ),
    },
    {
      accessorKey: "is_active",
      header: "Estado",
      cell: ({ row }) => (
        <StatusBadge tone={row.original.is_active === false ? "muted" : "success"}>
          {row.original.is_active === false ? "Inactivo" : "Activo"}
        </StatusBadge>
      ),
    },
    { accessorKey: "phone", header: "Telefono", cell: ({ row }) => row.original.phone ?? "Sin telefono" },
    {
      accessorKey: "notes",
      header: "Notas",
      cell: ({ row }) => <span className="block max-w-md truncate text-muted-foreground" title={row.original.notes ?? undefined}>{row.original.notes ?? "-"}</span>,
    },
    {
      id: "actions",
      header: () => <span className="block text-right">Acciones</span>,
      meta: { cellClassName: "text-right" },
      cell: ({ row }) => {
        const technician = row.original;
        return (
          <RowActions>
            <RowActionButton label={`Ver control de ${technician.name}`} tone="view" onClick={() => openControlForTechnician(technician)}><Eye className="h-4 w-4" /></RowActionButton>
            <RowActionButton label={`Editar a ${technician.name}`} tone="edit" onClick={() => openEdit(technician)}><Pencil className="h-4 w-4" /></RowActionButton>
            <RowActionButton label={technician.is_active === false ? `Activar a ${technician.name}` : `Marcar inactivo a ${technician.name}`} tone="muted" onClick={() => toggleActiveMutation.mutate({ id: technician.id, isActive: technician.is_active === false })}><Power className="h-4 w-4" /></RowActionButton>
            <RowActionButton label={`Eliminar a ${technician.name}`} tone="danger" onClick={() => setTechnicianToDelete(technician)}><Trash2 className="h-4 w-4" /></RowActionButton>
          </RowActions>
        );
      },
    },
  ];

  return (
    <AppLayout>
      <PageContainer archetype="workspace" className={`page-shell ${printMode ? "technician-material-print-mode" : ""}`}>
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
              <div className="flex flex-wrap items-center gap-2">
                <InfoBadge>{RANGE_LABELS[controlState.range]}</InfoBadge>
                <Button variant="outline" onClick={printMovements}>
                  <Printer className="mr-2 h-4 w-4" /> Imprimir movimientos
                </Button>
              </div>
            )
          }
        />

        {activeTab === "technicians" ? (
          <div className="grid gap-4">
            <FilterToolbar>
              <div className="relative w-full md:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input aria-label="Buscar tecnicos" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Buscar por nombre, telefono o nota..." />
              </div>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                <SelectTrigger aria-label="Estado" className="w-full md:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="inactive">Inactivos</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
            </FilterToolbar>

            <Card className="min-w-0 border-border/70 shadow-none">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div><CardTitle>Tecnicos</CardTitle><CardDescription>Listado y mantenimiento de tecnicos propios.</CardDescription></div>
                <CountBadge>{technicians.length} {technicians.length === 1 ? "registro" : "registros"}</CountBadge>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0" role="region" tabIndex={0} aria-label="Listado de tecnicos">
                <DataTable
                  className="min-w-[880px]"
                  columns={technicianColumns}
                  data={pagination.pagedItems}
                  isLoading={isLoading}
                  loadingMessage="Cargando tecnicos..."
                  emptyMessage="No hay tecnicos cargados."
                  getRowId={(technician) => technician.id}
                />
              </CardContent>
            </Card>
            <DataTablePagination {...pagination} pageSize={pageSize} pageSizeOptions={[20, 50, 100]} onPageChange={setPage} onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setPage(1); }} itemLabel="técnicos" />
          </div>
        ) : (
          <div className="grid gap-4">
            <FilterToolbar>
              <Select value={controlState.technicianId} onValueChange={(technicianId) => setControlState((current) => ({ ...current, technicianId }))}>
                <SelectTrigger aria-label="Tecnico" className="w-full md:w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los tecnicos</SelectItem>
                  {materialControl.technicians.map((technician) => (
                    <SelectItem key={technician.id} value={technician.id}>
                      {technician.name}{technician.is_active === false ? " (Inactivo)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={controlState.range} onValueChange={(range) => handleRangeChange(range as TechnicianMaterialControlState["range"])}>
                <SelectTrigger aria-label="Rango" className="w-full md:w-44"><SelectValue /></SelectTrigger>
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
                aria-label="Fecha desde"
                value={controlState.dateFrom}
                disabled={controlState.range !== "custom"}
                onChange={(event) => handleDateFromChange(event.target.value)}
              />
              <Input
                className="w-full md:w-40"
                type="date"
                aria-label="Fecha hasta"
                value={controlState.dateTo}
                disabled={controlState.range !== "custom"}
                onChange={(event) => handleDateToChange(event.target.value)}
              />
              <Select value={controlState.customerId} onValueChange={(customerId) => setControlState((current) => ({ ...current, customerId }))}>
                <SelectTrigger aria-label="Cliente" className="w-full md:w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los clientes</SelectItem>
                  {materialControl.customers.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={controlState.serviceId} onValueChange={(serviceId) => setControlState((current) => ({ ...current, serviceId }))}>
                <SelectTrigger aria-label="Trabajo" className="w-full md:w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los trabajos</SelectItem>
                  {materialControl.services.map((service) => <SelectItem key={service.id} value={service.id}>{service.jobTitle} / {service.title}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={controlState.type} onValueChange={(type) => setControlState((current) => ({ ...current, type: type as TechnicianMaterialControlState["type"] }))}>
                <SelectTrigger aria-label="Tipo" className="w-full md:w-44"><SelectValue /></SelectTrigger>
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
            </FilterToolbar>

            <MetricCard
              label="Margen bruto estimado"
              value={materialControl.report.totals.grossMargin}
              helper={`Valor comercial menos costo estimado entre ${formatBusinessDate(controlState.dateFrom)} y ${formatBusinessDate(controlState.dateTo)}.`}
              icon={<PackageCheck className="h-6 w-6" />}
            />
            <MetricGrid>
              <MetricCard label="Valor comercial" value={materialControl.report.totals.commercialBalance} tone="info" />
              <MetricCard label="Costo estimado" value={materialControl.report.totals.costNetValue} tone="warning" />
              <MetricCard label="Balance de materiales" value={materialControl.report.totals.materialBalance} />
              <MetricCard label="Remitos" value={materialControl.report.totals.remitos} format="plain" />
            </MetricGrid>
            <MetricGrid className="xl:grid-cols-3">
              <MetricCard label="Valor materiales entregados" value={materialControl.report.totals.materialDeliveredValue} tone="info" />
              <MetricCard label="Valor materiales devueltos" value={materialControl.report.totals.materialReturnedValue} tone="success" />
              <MetricCard label="Devoluciones" value={materialControl.report.totals.devoluciones} format="plain" />
              <MetricCard label="Clientes atendidos" value={materialControl.report.totals.clients} format="plain" />
              <MetricCard label="Trabajos vinculados" value={materialControl.report.totals.jobs} format="plain" />
              <MetricCard label="Movimientos por tecnico" value={materialControl.report.movements.length} format="plain" />
            </MetricGrid>

            <Card className="min-w-0 border-border/70 shadow-none">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div><CardTitle>Movimientos por tecnico</CardTitle><CardDescription>Resumen principal para cierre mensual por balance de materiales.</CardDescription></div>
                <CountBadge>{materialControl.report.technicianSummaries.length} registros</CountBadge>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table className="min-w-[1260px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tecnico</TableHead>
                      <TableHead className="text-right">Remitos</TableHead>
                      <TableHead className="text-right">Devoluciones</TableHead>
                      <TableHead className="text-right">Valor comercial</TableHead>
                      <TableHead className="text-right">Costo estimado</TableHead>
                      <TableHead className="text-right">Margen bruto estimado</TableHead>
                      <TableHead className="text-right">Balance de materiales</TableHead>
                      <TableHead className="text-right">Clientes</TableHead>
                      <TableHead className="text-right">Trabajos</TableHead>
                      <TableHead className="text-right">Accion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materialControl.isLoading ? <EmptyTableRow colSpan={10}>Cargando control de materiales...</EmptyTableRow> : null}
                    {!materialControl.isLoading && materialControl.report.technicianSummaries.length === 0 ? <EmptyTableRow colSpan={10}>No hay movimientos para el periodo filtrado.</EmptyTableRow> : null}
                    {materialControl.report.technicianSummaries.map((summary) => (
                      <TableRow key={summary.technicianId}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span>{summary.technicianName}</span>
                            {summary.technicianIsActive === false ? <StatusBadge tone="muted">Inactivo</StatusBadge> : null}
                            {summary.technicianMissing ? <StatusBadge tone="warning">Referencia huerfana</StatusBadge> : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{summary.remitos}</TableCell>
                        <TableCell className="text-right tabular-nums">{summary.devoluciones}</TableCell>
                        <TableCell className="text-right"><AmountDisplay value={summary.commercialBalance} size="sm" /></TableCell>
                        <TableCell className="text-right"><AmountDisplay value={summary.costNetValue} size="sm" /></TableCell>
                        <TableCell className="text-right"><AmountDisplay value={summary.grossMargin} size="sm" className="font-bold" /></TableCell>
                        <TableCell className="text-right"><AmountDisplay value={summary.materialBalance} size="sm" className="font-bold" /></TableCell>
                        <TableCell className="text-right tabular-nums">{summary.clients}</TableCell>
                        <TableCell className="text-right tabular-nums">{summary.jobs}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => { setSelectedSummary(summary); setDetailTab("documents"); }}>
                            Ver detalle
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="min-w-0 border-border/70 shadow-none">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div><CardTitle>Movimientos detallados</CardTitle><CardDescription>Remitos y devoluciones vinculados a tecnicos en el rango seleccionado.</CardDescription></div>
                <CountBadge>{materialControl.report.movements.length} registros</CountBadge>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table className="min-w-[1280px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tecnico</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Cliente / empresa</TableHead>
                      <TableHead>Trabajo / servicio</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Valor comercial</TableHead>
                      <TableHead className="text-right">Costo estimado</TableHead>
                      <TableHead className="text-right">Margen bruto estimado</TableHead>
                      <TableHead className="text-right">Accion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materialControl.report.movements.length === 0 ? <EmptyTableRow colSpan={11}>No hay movimientos detallados para mostrar.</EmptyTableRow> : null}
                    {materialControl.report.movements.map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell>{formatBusinessDate(movement.date)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{movement.technicianName}</span>
                            {movement.technicianIsActive === false ? <StatusBadge tone="muted">Inactivo</StatusBadge> : null}
                            {movement.technicianMissing ? <StatusBadge tone="warning">Referencia huerfana</StatusBadge> : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-sm font-medium">{movement.documentLabel}</div>
                          {movement.externalInvoiceNumber ? <div className="text-xs text-muted-foreground">Factura externa {movement.externalInvoiceNumber}</div> : null}
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={movement.documentType === "REMITO" ? "info" : "success"}>{movement.movementType === "Entrega" ? "Entrega" : "Devolucion"}</StatusBadge>
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
                        <TableCell className="text-right">
                          <AmountDisplay value={movement.commercialTotal} size="sm" />
                          <div className="text-xs text-muted-foreground">Materiales: <AmountDisplay value={movement.materialValue} size="sm" className="inline" /></div>
                        </TableCell>
                        <TableCell className="text-right"><AmountDisplay value={movement.estimatedCost} size="sm" /></TableCell>
                        <TableCell className="text-right"><AmountDisplay value={movement.grossMargin} size="sm" /></TableCell>
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
              </CardContent>
            </Card>

            <section className="technician-material-print" aria-label="Vista imprimible de movimientos">
              <header className="print-report-header">
                <div>
                  <p className="print-eyebrow">Stock Sur</p>
                  <h1>Control de materiales por tecnico</h1>
                  <p>Documento interno de control. No reemplaza comprobantes fiscales.</p>
                </div>
                <div className="print-meta">
                  <p><strong>Periodo:</strong> {formatBusinessDate(controlState.dateFrom)} a {formatBusinessDate(controlState.dateTo)}</p>
                  <p><strong>Tecnico:</strong> {selectedTechnicianName}</p>
                  <p><strong>Cliente / empresa:</strong> {selectedCustomerName}</p>
                  <p><strong>Trabajo / servicio:</strong> {selectedServiceName}</p>
                  <p><strong>Generado:</strong> {generatedAt}</p>
                </div>
              </header>
              <div className="print-summary-grid">
                <div><span>Valor comercial</span><strong><AmountDisplay value={materialControl.report.totals.commercialBalance} size="sm" /></strong></div>
                <div><span>Costo estimado</span><strong><AmountDisplay value={materialControl.report.totals.costNetValue} size="sm" /></strong></div>
                <div><span>Margen bruto estimado</span><strong><AmountDisplay value={materialControl.report.totals.grossMargin} size="sm" /></strong></div>
                <div><span>Balance de materiales</span><strong><AmountDisplay value={materialControl.report.totals.materialBalance} size="sm" /></strong></div>
                <div><span>Remitos</span><strong>{materialControl.report.totals.remitos}</strong></div>
                <div><span>Devoluciones</span><strong>{materialControl.report.totals.devoluciones}</strong></div>
                <div><span>Clientes</span><strong>{materialControl.report.totals.clients}</strong></div>
                <div><span>Trabajos</span><strong>{materialControl.report.totals.jobs}</strong></div>
              </div>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tecnico</th>
                    <th>Documento</th>
                    <th>Tipo</th>
                    <th>Cliente / empresa</th>
                    <th>Trabajo / servicio</th>
                    <th>Items</th>
                    <th>Valor comercial</th>
                    <th>Costo estimado</th>
                    <th>Margen bruto estimado</th>
                  </tr>
                </thead>
                <tbody>
                  {materialControl.report.movements.length === 0 ? (
                    <tr><td colSpan={10}>No hay movimientos detallados para el periodo filtrado.</td></tr>
                  ) : materialControl.report.movements.map((movement) => (
                    <tr key={`print-${movement.id}`}>
                      <td>{formatBusinessDate(movement.date)}</td>
                      <td>{movement.technicianName}</td>
                      <td>{movement.documentLabel}{movement.externalInvoiceNumber ? ` / Factura externa ${movement.externalInvoiceNumber}` : ""}</td>
                      <td>{movement.movementType === "Entrega" ? "Entrega" : "Devolucion"}</td>
                      <td>{movement.customerName}</td>
                      <td>{movement.serviceLabel ? `${movement.jobLabel} / ${movement.serviceLabel}` : "Sin trabajo vinculado"}</td>
                      <td>{movement.items}</td>
                      <td><AmountDisplay value={movement.commercialTotal} size="sm" /></td>
                      <td><AmountDisplay value={movement.estimatedCost} size="sm" /></td>
                      <td><AmountDisplay value={movement.grossMargin} size="sm" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <footer className="print-footer">
                Documento interno de control. Generado el {generatedAt}.
              </footer>
            </section>
          </div>
        )}
      </PageContainer>

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
        description={technicianToDelete ? `Esta accion eliminara a "${technicianToDelete.name}" solo si no tiene historial operativo. Si tiene remitos, servicios o trabajos vinculados, marcalo como Inactivo para conservar la trazabilidad.` : ""}
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
              <MetricGrid className="xl:grid-cols-3">
                <MetricCard label="Valor comercial entregado" value={selectedSummary.commercialDeliveredTotal} tone="info" />
                <MetricCard label="Valor comercial devuelto" value={selectedSummary.commercialReturnedTotal} tone="success" />
                <MetricCard label="Balance comercial" value={selectedSummary.commercialBalance} />
              </MetricGrid>
              <MetricGrid className="xl:grid-cols-3">
                <MetricCard label="Costo estimado entregado" value={selectedSummary.costDeliveredValue} tone="info" />
                <MetricCard label="Costo estimado devuelto" value={selectedSummary.costReturnedValue} tone="success" />
                <MetricCard label="Costo neto estimado" value={selectedSummary.costNetValue} />
              </MetricGrid>
              <MetricGrid className="xl:grid-cols-4">
                <MetricCard label="Margen bruto estimado" value={selectedSummary.grossMargin} />
                <MetricCard label="Materiales entregados" value={selectedSummary.materialDeliveredValue} tone="info" />
                <MetricCard label="Materiales devueltos" value={selectedSummary.materialReturnedValue} tone="success" />
                <MetricCard label="Balance de materiales" value={selectedSummary.materialBalance} />
              </MetricGrid>
              <div className="grid gap-3 md:grid-cols-3">
                <Card className="border-border/70 p-4 shadow-none"><p className="text-xs font-semibold text-muted-foreground">Clientes atendidos</p><p className="mt-1 text-2xl font-bold">{selectedSummary.clients}</p></Card>
                <Card className="border-border/70 p-4 shadow-none"><p className="text-xs font-semibold text-muted-foreground">Trabajos vinculados</p><p className="mt-1 text-2xl font-bold">{selectedSummary.jobs}</p></Card>
                <Card className="border-border/70 p-4 shadow-none"><p className="text-xs font-semibold text-muted-foreground">Movimientos</p><p className="mt-1 text-2xl font-bold">{selectedSummary.movements.length}</p></Card>
              </div>
              <Tabs value={detailTab} onValueChange={setDetailTab}>
                <TabsList>
                  <TabsTrigger value="documents">Documentos</TabsTrigger>
                  <TabsTrigger value="materials">Materiales</TabsTrigger>
                </TabsList>
                <TabsContent value="documents">
                  <div className="overflow-x-auto rounded-lg border">
                    <Table className="min-w-[1180px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Documento</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Trabajo / servicio</TableHead>
                          <TableHead className="text-right">Items</TableHead>
                          <TableHead className="text-right">Valor comercial</TableHead>
                          <TableHead className="text-right">Costo estimado</TableHead>
                          <TableHead className="text-right">Margen bruto estimado</TableHead>
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
                            <TableCell className="text-right">
                              <AmountDisplay value={movement.commercialTotal} size="sm" />
                              <div className="text-xs text-muted-foreground">Materiales: <AmountDisplay value={movement.materialValue} size="sm" className="inline" /></div>
                            </TableCell>
                            <TableCell className="text-right"><AmountDisplay value={movement.estimatedCost} size="sm" /></TableCell>
                            <TableCell className="text-right"><AmountDisplay value={movement.grossMargin} size="sm" /></TableCell>
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
