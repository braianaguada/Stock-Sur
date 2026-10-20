import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { DataTable } from "@/components/data-table/DataTable";
import { PrimaryCell } from "@/components/common/VisualSystem";
import { RowActions, RowActionButton } from "@/components/common/RowActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { useCreateSupplierPurchaseOrder } from "@/features/purchase-orders/hooks";
import { fetchSupplier } from "../queries";
import { supplierPriceBreakdown, type DisplayCurrency, type SupplierCartItem } from "../pricing";
import { supplierMoney } from "../pricing";

function SupplierCartGroup({ companyId, supplierId, items, currency, rate, onUpdate, onRemove, onCreated }: {
  companyId: string; supplierId: string; items: SupplierCartItem[]; currency: DisplayCurrency; rate?: number;
  onUpdate: (id: string, quantity: number) => void; onRemove: (id: string) => void; onCreated: (supplierId: string) => void;
}) {
  const supplier = useQuery({ queryKey: ["supplier-pricing", companyId, supplierId], queryFn: () => fetchSupplier(companyId, supplierId), staleTime: 0 });
  const create = useCreateSupplierPurchaseOrder();
  const [notes, setNotes] = useState("");
  const [confirm, setConfirm] = useState(false);
  const prices = items.map((item) => supplier.data ? supplierPriceBreakdown(item.line, supplier.data, currency, rate) : null);
  const complete = prices.every(Boolean);
  const totals = prices.reduce((sum, price, index) => ({ net: sum.net + (price?.net ?? 0) * items[index].quantity, vat: sum.vat + (price?.vat ?? 0) * items[index].quantity, freight: sum.freight + (price?.freight ?? 0) * items[index].quantity, total: sum.total + (price?.total ?? 0) * items[index].quantity }), { net: 0, vat: 0, freight: 0, total: 0 });
  const columns: ColumnDef<SupplierCartItem, unknown>[] = [
    { id: "name", header: "Producto / lista", cell: ({ row }) => <PrimaryCell title={row.original.line.product_name || row.original.line.raw_description} metadata={`${row.original.listName} · ${row.original.line.presentation_raw || "unidad"}`} /> },
    { id: "quantity", header: "Cantidad", cell: ({ row }) => <Input className="w-24" type="number" min={1} step={1} aria-label={`Cantidad de ${row.original.line.raw_description}`} disabled={create.isPending} value={row.original.quantity} onChange={(event) => onUpdate(row.original.line.id, Math.max(1, Math.trunc(Number(event.target.value) || 1)))} /> },
    { id: "net", header: "Subtotal sin IVA", cell: ({ row }) => { const price = supplier.data && supplierPriceBreakdown(row.original.line, supplier.data, currency, rate); return supplierMoney(price ? price.net * row.original.quantity : null, currency); } },
    { id: "remove", header: "", cell: ({ row }) => <RowActions><RowActionButton label="Quitar producto" disabled={create.isPending} onClick={() => onRemove(row.original.line.id)}><Trash2 className="h-4 w-4" /></RowActionButton></RowActions> },
  ];
  return <section className="min-w-0 space-y-4 rounded-lg border bg-card p-4">
    <h2 className="font-semibold">{supplier.data?.name ?? "Proveedor"}</h2>
    {supplier.error ? <p role="alert" className="text-sm text-destructive">No se pudo cargar la configuración del proveedor. <Button variant="link" onClick={() => void supplier.refetch()}>Reintentar</Button></p> : null}
    {supplier.data && !supplier.data.is_active ? <p role="alert" className="text-sm text-destructive">El proveedor está inactivo. No se puede generar una orden.</p> : null}
    <DataTable columns={columns} data={items} getRowId={(item) => item.line.id} density="compact" emptyMessage="No hay productos en este carrito." />
    <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">{(["net", "vat", "freight", "total"] as const).map((field) => <div key={field}><dt className="text-muted-foreground">{({ net: "Sin impuestos", vat: `IVA ${supplier.data?.vat_rate ?? 21}%`, freight: `Flete ${supplier.data?.freight_rate ?? 0}% sobre neto`, total: "Total con IVA y flete" })[field]}</dt><dd className="font-semibold tabular-nums">{supplierMoney(complete ? totals[field] : null, currency)}</dd></div>)}</dl>
    {!complete && supplier.data ? <p className="text-sm text-destructive">No se puede calcular el total: actualizá la cotización BNA o revisá los precios y el IVA de la lista.</p> : null}
    <Input aria-label={`Observaciones para ${supplier.data?.name ?? "proveedor"}`} placeholder="Observaciones para la orden" value={notes} disabled={create.isPending} onChange={(event) => setNotes(event.target.value)} />
    <p className="text-xs text-muted-foreground">La orden conserva la moneda original de cada producto. La conversión BNA es para visualizar y comparar; no fija el tipo de cambio de pago.</p>
    {create.error ? <p role="alert" className="text-sm text-destructive">{create.error.message}</p> : null}
    <Button disabled={!supplier.data?.is_active || !complete || create.isPending || supplier.isFetching} onClick={() => setConfirm(true)}>Generar orden de compra</Button>
    <AlertDialog open={confirm} onOpenChange={(open) => { if (!create.isPending) setConfirm(open); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Crear orden para {supplier.data?.name}</AlertDialogTitle><AlertDialogDescription>{items.length} productos · Total estimado {supplierMoney(totals.total, currency)}. Se creará un borrador con los precios vigentes y la configuración de IVA y flete del proveedor.</AlertDialogDescription></AlertDialogHeader>{create.error ? <p role="alert" className="text-sm text-destructive">{create.error.message}</p> : null}<AlertDialogFooter><AlertDialogCancel disabled={create.isPending}>Cancelar</AlertDialogCancel><Button disabled={create.isPending || !complete || !supplier.data?.is_active || supplier.isFetching} onClick={() => create.mutate({ companyId, supplierId, catalogVersionId: items[0].versionId, lines: items.map((item) => ({ catalogLineId: item.line.id, quantity: item.quantity })), notes }, { onSuccess: () => { setConfirm(false); onCreated(supplierId); } })}>{create.isPending ? "Creando…" : "Confirmar orden"}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}

export function SupplierCart(props: { companyId: string; items: SupplierCartItem[]; currency: DisplayCurrency; rate?: number; onUpdate: (id: string, quantity: number) => void; onRemove: (id: string) => void; onCreated: (supplierId: string) => void }) {
  const supplierIds = [...new Set(props.items.map((item) => item.supplierId))];
  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{props.items.length} productos en {supplierIds.length} proveedores. El carrito se conserva al navegar entre listas hasta salir del módulo.</p><Button variant="outline" asChild><Link to="/purchase-orders">Ver órdenes de compra</Link></Button></div>{supplierIds.length === 0 ? <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Agregá productos desde las listas o la comparación.</p> : supplierIds.map((id) => <SupplierCartGroup key={id} {...props} supplierId={id} items={props.items.filter((item) => item.supplierId === id)} />)}</div>;
}
