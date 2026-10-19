import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { ItemSupplierSelect } from "@/features/items/components/ItemSupplierSelect";
import { saveManualPurchaseOrder, type ManualPurchaseOrderInput } from "@/features/purchase-orders/api";
import { purchaseOrderKeys, useSupplierPurchaseOrders, useSupplierPurchaseOrderLines } from "@/features/purchase-orders/hooks";
import { useToast } from "@/hooks/use-toast";

import { PurchaseOrderCollectorSelect } from "@/features/purchase-orders/PurchaseOrderCollectorSelect";

type Line = ManualPurchaseOrderInput["lines"][number] & { key: string };
const newLine = (): Line => ({ key: crypto.randomUUID(), description: "", code: "", quantity: 1, unit_cost: 0, currency: "ARS" });
const fields = [["date", "Fecha", "date"], ["address", "Domicilio del proveedor", "text"], ["condition", "Condición de compra", "text"], ["collected_by", "Retira", "text"], ["reference", "Referencia", "text"], ["authorized_by", "Autorizado por", "text"], ["prepared_by", "Preparado por", "text"], ["notes", "Observaciones", "text"]] as const;

export default function PurchaseOrderEditor() {
  const { currentCompany } = useAuth();
  const { orderId } = useParams();
  return <AppLayout><PageContainer>{currentCompany ? <Editor key={`${currentCompany.id}:${orderId ?? "new"}`} companyId={currentCompany.id} orderId={orderId} /> : <p>Seleccioná una empresa activa para cargar una orden.</p>}</PageContainer></AppLayout>;
}

function Editor({ companyId, orderId }: { companyId: string; orderId?: string }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { roles, companyPermissionCodes } = useAuth();
  const canEdit = roles.includes("superadmin") || companyPermissionCodes.includes("suppliers.edit");
  const orders = useSupplierPurchaseOrders(orderId ? companyId : null);
  const source = orders.data?.find(order => order.id === orderId);
  const sourceLines = useSupplierPurchaseOrderLines(companyId, orderId);
  const [supplierId, setSupplierId] = useState("");
  const [form, setForm] = useState<Record<string, string>>({ date: new Date().toLocaleDateString("en-CA") });
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const initialized = useRef(false);
  const requestId = useRef(crypto.randomUUID());
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!source || !sourceLines.data || initialized.current) return;
    initialized.current = true;
    setSupplierId(source.supplier_id);
    setForm({ ...source.form_data, notes: source.notes ?? "" });
    setLines(sourceLines.data.map(line => ({ key: line.id, description: line.product_name_snapshot, code: line.supplier_code_snapshot ?? "", quantity: Number(line.quantity), unit_cost: Number(line.unit_cost), currency: line.currency })));
  }, [source, sourceLines.data]);
  const save = useMutation({
    mutationFn: () => saveManualPurchaseOrder({ companyId, orderId: orderId ?? null, requestId: requestId.current, supplierId, form, lines }),
    onSuccess: async order => {
      await queryClient.invalidateQueries({ queryKey: ["supplier-purchase-orders", companyId] });
      await queryClient.invalidateQueries({ queryKey: purchaseOrderKeys.lines(companyId, order.id) });
      if (!mounted.current) return;
      toast({ title: "Orden guardada", description: `Número ${order.order_number}. Ya podés imprimirla o descargar el PDF.` });
      navigate(`/purchase-orders?order=${order.id}`);
    },
    onError: (error: Error) => { if (mounted.current) toast({ title: "No se pudo guardar la orden", description: error.message, variant: "destructive" }); },
  });
  if (orderId && (orders.isLoading || sourceLines.isLoading)) return <p role="status">Cargando orden...</p>;
  if (orderId && (orders.error || sourceLines.error)) return <div role="alert"><p>No se pudo cargar la orden. Volvé a intentar.</p><Button onClick={() => { void orders.refetch(); void sourceLines.refetch(); }}>Reintentar</Button></div>;
  if (orderId && (!source || source.status !== "DRAFT" || source.source_catalog_version_id)) return <p role="alert">Esta orden no se puede editar desde la carga manual.</p>;
  const valid = supplierId && lines.length > 0 && lines.every(line => line.description.trim() && Number.isInteger(line.quantity) && line.quantity > 0 && line.unit_cost >= 0.01 && line.unit_cost <= 1_000_000_000);
  const updateLine = (key: string, patch: Partial<Line>) => setLines(current => current.map(line => line.key === key ? { ...line, ...patch } : line));
  return <form className="space-y-6" onSubmit={event => { event.preventDefault(); if (valid && canEdit && !save.isPending) save.mutate(); }}>
    <PageHeader eyebrow="Compras" title={source ? `Editar orden #${source.order_number}` : "Nueva orden de compra"} description="Guardá el borrador antes de imprimir o compartir. Esta orden no modifica stock, caja ni cuenta corriente." actions={<Button type="submit" disabled={!valid || !canEdit || save.isPending}>{save.isPending ? "Guardando..." : "Guardar borrador"}</Button>} />
    {!canEdit && <p role="alert">Necesitás permiso para editar proveedores para cargar órdenes.</p>}
    <fieldset disabled={save.isPending || !canEdit} className="space-y-6">
      <Card><CardContent className="grid gap-4 pt-6 md:grid-cols-2"><div className="space-y-2"><Label>Proveedor registrado</Label><ItemSupplierSelect companyId={companyId} value={supplierId} onChange={(id, _name, address) => { setSupplierId(id); setForm(current => ({ ...current, address })); }} /></div>{fields.map(([key, label, type]) => <div key={key} className="space-y-2"><Label htmlFor={`po-${key}`}>{label}</Label>{key === "collected_by" ? <PurchaseOrderCollectorSelect companyId={companyId} value={form.collected_by ?? ""} onChange={name => setForm(current => ({ ...current, collected_by: name }))} /> : <Input id={`po-${key}`} type={type} maxLength={key === "notes" ? 240 : 120} value={form[key] ?? ""} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} />}</div>)}</CardContent></Card>
      <div className="space-y-3"><h2 className="text-lg font-semibold">Productos solicitados</h2>{lines.map((line, index) => <div key={line.key} role="group" aria-label={`Producto ${index + 1}`} className="grid grid-cols-2 items-end gap-2 border-b pb-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)_auto]">
        <div className="col-span-2 min-w-0 space-y-1 lg:col-span-1"><Label htmlFor={`description-${line.key}`}>Descripción {index + 1}</Label><Input id={`description-${line.key}`} required maxLength={240} value={line.description} onChange={event => updateLine(line.key, { description: event.target.value })} /></div>
        <div className="min-w-0 space-y-1"><Label htmlFor={`code-${line.key}`}>Código del proveedor</Label><Input id={`code-${line.key}`} maxLength={100} value={line.code} onChange={event => updateLine(line.key, { code: event.target.value })} /></div>
        <div className="min-w-0 space-y-1"><Label htmlFor={`qty-${line.key}`}>Cantidad</Label><Input id={`qty-${line.key}`} type="number" min={1} max={1000000} step={1} required value={line.quantity} onChange={event => updateLine(line.key, { quantity: Number(event.target.value) })} /></div>
        <div className="min-w-0 space-y-1"><Label htmlFor={`cost-${line.key}`}>Costo unitario</Label><Input id={`cost-${line.key}`} type="number" min={0.01} max={1000000000} step={0.01} required value={line.unit_cost} onChange={event => updateLine(line.key, { unit_cost: Number(event.target.value) })} /></div>
        <div className="min-w-0 space-y-1"><Label htmlFor={`currency-${line.key}`}>Moneda</Label><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" id={`currency-${line.key}`} value={line.currency} onChange={event => updateLine(line.key, { currency: event.target.value as Line["currency"] })}><option value="ARS">ARS</option><option value="USD">USD</option></select></div>
        <Button type="button" variant="ghost" size="icon" aria-label={`Quitar producto ${index + 1}`} title={`Quitar producto ${index + 1}`} onClick={() => setLines(current => current.filter(item => item.key !== line.key))}><Trash2 aria-hidden="true" /></Button>
      </div>)}<Button type="button" variant="outline" disabled={lines.length >= 200} onClick={() => setLines(current => [...current, newLine()])}>Agregar producto</Button></div>
    </fieldset>
    <div className="flex flex-wrap gap-2"><Button type="submit" disabled={!valid || !canEdit || save.isPending}>Guardar borrador</Button><Button type="button" variant="outline" disabled={save.isPending} onClick={() => { if (window.confirm("¿Volver al listado y descartar los cambios sin guardar?")) navigate("/purchase-orders"); }}>Volver al listado</Button></div>
  </form>;
}
