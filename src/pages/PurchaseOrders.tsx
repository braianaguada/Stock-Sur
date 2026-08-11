import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Search, Send, ShoppingCart, Trash2, XCircle } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { EntityDialog } from "@/components/common/EntityDialog";
import { RowActionButton, RowActions } from "@/components/common/RowActions";
import { CountBadge, MoneyCell, PrimaryCell, StatusBadge } from "@/components/common/VisualSystem";
import { DataTable } from "@/components/data-table/DataTable";
import { DataTablePagination } from "@/components/data-table/DataTablePagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterToolbar, PageContainer, PageHeader } from "@/components/ui/page";
import { useAuth } from "@/contexts/AuthContext";
import {
  deleteSupplierPurchaseOrderDraft,
  transitionSupplierPurchaseOrder,
  updateSupplierPurchaseOrderDraft,
} from "@/features/purchase-orders/api";
import {
  purchaseOrderKeys,
  useSupplierPurchaseOrderLines,
  useSupplierPurchaseOrders,
} from "@/features/purchase-orders/hooks";
import {
  purchaseOrderActions,
  type PurchaseOrderStatus,
  type SupplierPurchaseOrder,
  type SupplierPurchaseOrderLine,
} from "@/features/purchase-orders/types";
import { PURCHASE_ORDER_STATUS_LABELS, PURCHASE_ORDER_STATUS_TONES } from "@/features/purchase-orders/presentation";
import { useToast } from "@/hooks/use-toast";
import { usePaginationSlice } from "@/hooks/use-pagination-slice";

const money = (currency: string, value: number) =>
  `${currency} ${Number(value).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type PendingAction = { order: SupplierPurchaseOrder; action: "SENT" | "CANCELLED" | "DELETE" };

export default function PurchaseOrders() {
  const { currentCompany } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PurchaseOrderStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [draftNotes, setDraftNotes] = useState("");
  const [draftQuantities, setDraftQuantities] = useState<Record<string, number>>({});
  const [confirmation, setConfirmation] = useState<PendingAction | null>(null);

  const companyId = currentCompany?.id ?? null;
  const ordersQuery = useSupplierPurchaseOrders(companyId);
  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const selected = orders.find((order) => order.id === searchParams.get("order")) ?? null;
  const linesQuery = useSupplierPurchaseOrderLines(companyId, selected?.id);
  const lines = useMemo(() => linesQuery.data ?? [], [linesQuery.data]);

  useEffect(() => {
    setDraftNotes(selected?.notes ?? "");
    setDraftQuantities(Object.fromEntries(lines.map((line) => [line.id, Number(line.quantity)])));
  }, [lines, selected?.id, selected?.notes, selected?.updated_at]);

  const draftIsValid = lines.length > 0 && lines.every((line) => {
    const quantity = draftQuantities[line.id];
    return Number.isInteger(quantity) && quantity > 0;
  });
  const selectedTotals = useMemo(() => lines.reduce<Record<string, number>>((totals, line) => {
    const quantity = selected?.status === "DRAFT" ? draftQuantities[line.id] ?? Number(line.quantity) : Number(line.quantity);
    totals[line.currency] = (totals[line.currency] ?? 0) + quantity * Number(line.unit_cost);
    return totals;
  }, {}), [draftQuantities, lines, selected?.status]);
  const lineColumns = useMemo<ColumnDef<SupplierPurchaseOrderLine, unknown>[]>(() => [
    {
      accessorKey: "product_name_snapshot",
      header: () => "Producto",
      cell: ({ row }) => <PrimaryCell title={row.original.product_name_snapshot} metadata={`${row.original.supplier_code_snapshot ?? "S/COD"} · ${row.original.raw_description_snapshot}`} />,
    },
    {
      accessorKey: "quantity",
      header: () => <span className="block text-right">Cantidad</span>,
      cell: ({ row }) => {
        const quantity = selected?.status === "DRAFT" ? draftQuantities[row.original.id] ?? Number(row.original.quantity) : Number(row.original.quantity);
        return selected?.status === "DRAFT" ? <Input aria-label={`Cantidad de ${row.original.product_name_snapshot}`} className="ml-auto w-24 text-right" type="number" min="1" step="1" value={quantity} onChange={(event) => setDraftQuantities((current) => ({ ...current, [row.original.id]: Number(event.target.value) }))} /> : <span className="tabular-nums">{quantity}</span>;
      },
      meta: { className: "text-right", cellClassName: "text-right" },
    },
    {
      accessorKey: "unit_cost",
      header: () => <span className="block text-right">Costo</span>,
      cell: ({ row }) => <MoneyCell value={money(row.original.currency, row.original.unit_cost)} format="plain" />,
      meta: { className: "hidden sm:table-cell text-right", cellClassName: "hidden sm:table-cell text-right" },
    },
    {
      id: "subtotal",
      header: () => <span className="block text-right">Subtotal</span>,
      cell: ({ row }) => {
        const quantity = selected?.status === "DRAFT" ? draftQuantities[row.original.id] ?? Number(row.original.quantity) : Number(row.original.quantity);
        return <MoneyCell value={money(row.original.currency, quantity * Number(row.original.unit_cost))} format="plain" />;
      },
      meta: { className: "text-right", cellClassName: "text-right" },
    },
  ], [draftQuantities, selected?.status]);
  const filtered = useMemo(() => orders.filter((order) => {
    if (status !== "ALL" && order.status !== status) return false;
    const needle = search.trim().toLocaleLowerCase("es");
    return !needle || `${order.order_number} ${order.supplier_name_snapshot}`.toLocaleLowerCase("es").includes(needle);
  }), [orders, search, status]);
  const pagination = usePaginationSlice({ items: filtered, page, pageSize });

  useEffect(() => setPage(1), [search, status, companyId]);

  const columns = useMemo<ColumnDef<SupplierPurchaseOrder, unknown>[]>(() => [
    { accessorKey: "order_number", header: () => "Orden", cell: ({ row }) => <PrimaryCell title={`OC #${row.original.order_number}`} metadata={row.original.supplier_name_snapshot} /> },
    { accessorKey: "supplier_name_snapshot", header: () => "Proveedor", cell: ({ row }) => row.original.supplier_name_snapshot, meta: { className: "hidden md:table-cell", cellClassName: "hidden md:table-cell" } },
    { accessorKey: "created_at", header: () => "Creada", cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString("es-AR"), meta: { className: "hidden lg:table-cell", cellClassName: "hidden lg:table-cell text-muted-foreground" } },
    {
      id: "total",
      header: () => <span className="block text-right">Total</span>,
      cell: ({ row }) => <div className="space-y-1">{Object.entries(row.original.totals_by_currency).map(([currency, total]) => <MoneyCell key={currency} value={money(currency, total ?? 0)} format="plain" />)}</div>,
      meta: { className: "text-right", cellClassName: "text-right" },
    },
    {
      accessorKey: "status",
      header: () => "Estado",
      cell: ({ row }) => <StatusBadge tone={PURCHASE_ORDER_STATUS_TONES[row.original.status]}>{PURCHASE_ORDER_STATUS_LABELS[row.original.status]}</StatusBadge>,
      meta: { className: "hidden sm:table-cell", cellClassName: "hidden sm:table-cell" },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => {
        const actions = purchaseOrderActions(row.original.status);
        return <RowActions>
          <RowActionButton label={`Ver orden #${row.original.order_number}`} tone="view" onClick={() => setSearchParams({ order: row.original.id })}><Eye className="h-4 w-4" /></RowActionButton>
          {actions.canSend ? <RowActionButton label="Marcar enviada" tone="success" onClick={() => setConfirmation({ order: row.original, action: "SENT" })}><Send className="h-4 w-4" /></RowActionButton> : null}
          {actions.canCancel ? <RowActionButton label="Cancelar orden" tone="warning" onClick={() => setConfirmation({ order: row.original, action: "CANCELLED" })}><XCircle className="h-4 w-4" /></RowActionButton> : null}
          {actions.canDelete ? <RowActionButton label="Eliminar borrador" tone="danger" onClick={() => setConfirmation({ order: row.original, action: "DELETE" })}><Trash2 className="h-4 w-4" /></RowActionButton> : null}
        </RowActions>;
      },
      meta: { className: "w-[180px] text-right", cellClassName: "text-right" },
    },
  ], [setSearchParams]);

  const refreshOrder = async (orderId?: string) => {
    await queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.list(companyId) });
    if (orderId) await queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lines(companyId, orderId) });
  };

  const actionMutation = useMutation({
    mutationFn: async ({ order, action }: PendingAction) => {
      if (!companyId) throw new Error("Necesitás una empresa activa.");
      if (action === "DELETE") return deleteSupplierPurchaseOrderDraft(companyId, order.id);
      return transitionSupplierPurchaseOrder(companyId, order.id, action);
    },
    onSuccess: async (_, variables) => {
      await refreshOrder(variables.order.id);
      if (variables.action === "DELETE") setSearchParams({});
      toast({ title: variables.action === "DELETE" ? "Borrador eliminado" : "Estado de la orden actualizado" });
      setConfirmation(null);
    },
    onError: (error: Error) => toast({ title: "No se pudo actualizar la orden", description: error.message, variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !selected || selected.status !== "DRAFT") {
        throw new Error("Solo se pueden editar órdenes en borrador.");
      }
      if (!draftIsValid) throw new Error("Revisá las cantidades: deben ser números enteros mayores a cero.");
      return updateSupplierPurchaseOrderDraft({
        companyId,
        orderId: selected.id,
        notes: draftNotes,
        lines: lines.map((line) => ({ lineId: line.id, quantity: draftQuantities[line.id] })),
      });
    },
    onSuccess: async (order) => {
      await refreshOrder(order.id);
      toast({ title: "Borrador actualizado" });
    },
    onError: (error: Error) => toast({ title: "No se pudo guardar el borrador", description: error.message, variant: "destructive" }),
  });

  return (
    <AppLayout>
      <PageContainer className="page-shell">
        {!currentCompany ? <CompanyAccessNotice description="Necesitás una empresa activa para consultar órdenes de compra." /> : null}
        <PageHeader
          eyebrow="Compras"
          title="Órdenes de compra"
          description="Documentos generados desde catálogos de proveedores. Los borradores se pueden editar o eliminar; las órdenes enviadas se conservan en el historial."
          actions={<Button variant="outline" onClick={() => navigate("/suppliers")}><ShoppingCart className="mr-2 h-4 w-4" /> Armar desde catálogos</Button>}
        />
        <FilterToolbar>
          <div className="relative w-full md:max-w-sm">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Buscar órdenes de compra" className="pl-9" placeholder="Buscar por número o proveedor" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <Select value={status} onValueChange={(value) => setStatus(value as PurchaseOrderStatus | "ALL")}>
            <SelectTrigger aria-label="Filtrar órdenes por estado" className="w-full md:w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los estados</SelectItem>
              {Object.entries(PURCHASE_ORDER_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterToolbar>

        <Card className="min-w-0 border-border/70 shadow-none">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Historial de órdenes</CardTitle>
              <CardDescription>Seguimiento operativo por proveedor y estado.</CardDescription>
            </div>
            <CountBadge>{filtered.length} {filtered.length === 1 ? "registro" : "registros"}</CountBadge>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              data={pagination.pagedItems}
              isLoading={ordersQuery.isLoading}
              loadingMessage="Cargando órdenes..."
              emptyMessage="No hay órdenes que coincidan con los filtros."
              errorMessage={ordersQuery.isError ? `No se pudieron cargar las órdenes: ${ordersQuery.error.message}` : undefined}
              onRetry={() => ordersQuery.refetch()}
            />
          </CardContent>
        </Card>
        {!ordersQuery.isError ? <DataTablePagination {...pagination} pageSize={pageSize} pageSizeOptions={[20, 50, 100]} onPageChange={setPage} onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setPage(1); }} itemLabel="órdenes" /> : null}
      </PageContainer>

      <EntityDialog
        open={Boolean(selected)}
        onOpenChange={(open) => { if (!open) setSearchParams({}); }}
        title={selected ? `Orden de compra #${selected.order_number}` : "Orden de compra"}
        description={selected?.supplier_name_snapshot}
        footer={selected?.status === "DRAFT" ? <Button disabled={!draftIsValid || saveMutation.isPending || linesQuery.isLoading} onClick={() => saveMutation.mutate()}>{saveMutation.isPending ? "Guardando..." : "Guardar cambios"}</Button> : undefined}
      >
        {selected ? <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><StatusBadge tone={PURCHASE_ORDER_STATUS_TONES[selected.status]}>{PURCHASE_ORDER_STATUS_LABELS[selected.status]}</StatusBadge><span className="text-sm text-muted-foreground">{new Date(selected.created_at).toLocaleString("es-AR")}</span></div>
          {selected.status === "DRAFT" ? <p className="text-sm text-muted-foreground">Podés ajustar cantidades y notas mientras la orden siga en borrador. Los precios conservan la lista que originó la orden.</p> : null}
          <Input value={draftNotes} disabled={selected.status !== "DRAFT"} placeholder="Notas de la orden" onChange={(event) => setDraftNotes(event.target.value)} />
          <div className="rounded-xl border">
            <DataTable
              columns={lineColumns}
              data={lines}
              emptyMessage="La orden no tiene productos."
              isLoading={linesQuery.isLoading}
              loadingMessage="Cargando productos..."
              errorMessage={linesQuery.isError ? `No se pudieron cargar los productos: ${linesQuery.error.message}` : undefined}
              onRetry={() => linesQuery.refetch()}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-4">{Object.entries(selectedTotals).map(([currency, total]) => <div key={currency}><span className="mr-2 text-sm text-muted-foreground">Total {currency}</span><MoneyCell className="inline-block text-lg" value={money(currency, total)} format="plain" /></div>)}</div>
        </div> : null}
      </EntityDialog>

      <ConfirmDeleteDialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => { if (!open) setConfirmation(null); }}
        title={confirmation?.action === "DELETE" ? "Eliminar borrador" : "Confirmar cambio de estado"}
        description={confirmation ? `${confirmation.action === "DELETE" ? "Se eliminará" : "Se actualizará"} la orden #${confirmation.order.order_number}. Las órdenes enviadas no se eliminan: se conservan o cancelan.` : ""}
        confirmLabel={confirmation?.action === "DELETE" ? "Eliminar" : "Confirmar"}
        isPending={actionMutation.isPending}
        onConfirm={() => { if (confirmation) actionMutation.mutate(confirmation); }}
      />
    </AppLayout>
  );
}
