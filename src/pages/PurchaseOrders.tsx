import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, Search, ShoppingCart } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { CompanyAccessNotice } from "@/components/common/CompanyAccessNotice";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { EntityDialog } from "@/components/common/EntityDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterBar, PageHeader } from "@/components/ui/page";
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
  PURCHASE_ORDER_STATUS_LABELS,
  purchaseOrderActions,
  type PurchaseOrderStatus,
  type SupplierPurchaseOrder,
} from "@/features/purchase-orders/types";
import { useToast } from "@/hooks/use-toast";

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
  const filtered = useMemo(() => orders.filter((order) => {
    if (status !== "ALL" && order.status !== status) return false;
    const needle = search.trim().toLocaleLowerCase("es");
    return !needle || `${order.order_number} ${order.supplier_name_snapshot}`.toLocaleLowerCase("es").includes(needle);
  }), [orders, search, status]);

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
      <div className="page-shell">
        {!currentCompany ? <CompanyAccessNotice description="Necesitás una empresa activa para consultar órdenes de compra." /> : null}
        <PageHeader
          eyebrow="Compras"
          title="Órdenes de compra"
          description="Documentos generados desde catálogos de proveedores. Los borradores se pueden editar o eliminar; las órdenes enviadas se conservan en el historial."
          actions={<Button variant="outline" onClick={() => navigate("/suppliers")}><ShoppingCart className="mr-2 h-4 w-4" /> Armar desde catálogos</Button>}
        />
        <FilterBar>
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por número o proveedor" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <Select value={status} onValueChange={(value) => setStatus(value as PurchaseOrderStatus | "ALL")}>
            <SelectTrigger className="w-full md:w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los estados</SelectItem>
              {Object.entries(PURCHASE_ORDER_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterBar>

        {ordersQuery.isLoading ? <Card><CardContent className="p-8 text-sm text-muted-foreground">Cargando órdenes...</CardContent></Card> : null}
        {ordersQuery.isError ? <Card className="border-destructive/40"><CardContent className="p-8 text-sm text-destructive">No se pudieron cargar las órdenes: {ordersQuery.error.message}</CardContent></Card> : null}
        {!ordersQuery.isLoading && !ordersQuery.isError && filtered.length === 0 ? (
          <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Todavía no hay órdenes para estos filtros.</CardContent></Card>
        ) : null}
        <div className="grid gap-3">
          {filtered.map((order) => {
            const actions = purchaseOrderActions(order.status);
            return (
              <Card key={order.id} className="overflow-hidden">
                <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">OC #{order.order_number}</span>
                      <Badge variant={order.status === "CANCELLED" ? "outline" : "secondary"}>{PURCHASE_ORDER_STATUS_LABELS[order.status]}</Badge>
                    </div>
                    <div className="mt-1 font-medium">{order.supplier_name_snapshot}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString("es-AR")}</div>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm">
                      {Object.entries(order.totals_by_currency).map(([currency, total]) => <span key={currency} className="font-semibold">{money(currency, total ?? 0)}</span>)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSearchParams({ order: order.id })}><Eye className="mr-2 h-4 w-4" /> Ver orden</Button>
                    {actions.canSend ? <Button size="sm" onClick={() => setConfirmation({ order, action: "SENT" })}>Marcar enviada</Button> : null}
                    {actions.canCancel ? <Button variant="outline" size="sm" onClick={() => setConfirmation({ order, action: "CANCELLED" })}>Cancelar</Button> : null}
                    {actions.canDelete ? <Button variant="destructive" size="sm" onClick={() => setConfirmation({ order, action: "DELETE" })}>Eliminar borrador</Button> : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <EntityDialog
        open={Boolean(selected)}
        onOpenChange={(open) => { if (!open) setSearchParams({}); }}
        title={selected ? `Orden de compra #${selected.order_number}` : "Orden de compra"}
        description={selected?.supplier_name_snapshot}
        footer={selected?.status === "DRAFT" ? <Button disabled={!draftIsValid || saveMutation.isPending || linesQuery.isLoading} onClick={() => saveMutation.mutate()}>{saveMutation.isPending ? "Guardando..." : "Guardar cambios"}</Button> : undefined}
      >
        {selected ? <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><Badge>{PURCHASE_ORDER_STATUS_LABELS[selected.status]}</Badge><span className="text-sm text-muted-foreground">{new Date(selected.created_at).toLocaleString("es-AR")}</span></div>
          {selected.status === "DRAFT" ? <p className="text-sm text-muted-foreground">Podés ajustar cantidades y notas mientras la orden siga en borrador. Los precios conservan la lista que originó la orden.</p> : null}
          <Input value={draftNotes} disabled={selected.status !== "DRAFT"} placeholder="Notas de la orden" onChange={(event) => setDraftNotes(event.target.value)} />
          {linesQuery.isLoading ? <div className="py-6 text-sm text-muted-foreground">Cargando productos...</div> : null}
          {linesQuery.isError ? <div className="py-6 text-sm text-destructive">No se pudieron cargar los productos: {linesQuery.error.message}</div> : null}
          {!linesQuery.isLoading && !linesQuery.isError ? <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[650px] text-sm"><thead className="bg-muted/40"><tr><th className="p-3 text-left">Código</th><th className="p-3 text-left">Descripción</th><th className="p-3 text-right">Cantidad</th><th className="p-3 text-right">Costo</th><th className="p-3 text-right">Subtotal</th></tr></thead><tbody>{lines.map((line) => {
            const quantity = selected.status === "DRAFT" ? draftQuantities[line.id] ?? Number(line.quantity) : Number(line.quantity);
            return <tr key={line.id} className="border-t"><td className="p-3 font-mono text-xs">{line.supplier_code_snapshot ?? "S/COD"}</td><td className="p-3 font-medium">{line.product_name_snapshot}<div className="mt-1 text-xs font-normal text-muted-foreground">{line.raw_description_snapshot}</div></td><td className="p-3 text-right">{selected.status === "DRAFT" ? <Input className="ml-auto w-24 text-right" type="number" min="1" step="1" value={quantity} onChange={(event) => setDraftQuantities((current) => ({ ...current, [line.id]: Number(event.target.value) }))} /> : quantity}</td><td className="p-3 text-right">{money(line.currency, line.unit_cost)}</td><td className="p-3 text-right font-semibold">{money(line.currency, quantity * Number(line.unit_cost))}</td></tr>;
          })}</tbody></table></div> : null}
          <div className="flex flex-wrap justify-end gap-4">{Object.entries(selectedTotals).map(([currency, total]) => <div key={currency}><span className="mr-2 text-sm text-muted-foreground">Total {currency}</span><span className="text-lg font-semibold">{money(currency, total)}</span></div>)}</div>
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
