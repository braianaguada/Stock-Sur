import { lazy, Suspense, useCallback, useState, type ReactNode } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getEffectiveIdentityKey } from "@/contexts/auth-query-lifecycle";
import { EntityDialog } from "@/components/common/EntityDialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { fetchSupplierComparisonVersions } from "../comparison/queries";
import { fetchSupplier } from "../queries";
import { addSupplierCartItem, supplierMoney, supplierPriceBreakdown, type DisplayCurrency, type SupplierCartItem } from "../pricing";
import { useSupplierExchangeRate } from "../hooks/useSupplierExchangeRate";
import { SupplierCurrencyToolbar } from "./SupplierCurrencyToolbar";
import { SupplierCartTrigger } from "./SupplierCartTrigger";
import { SupplierPurchasingContext as Context, useSupplierPurchasing } from "../hooks/useSupplierPurchasing";

const SupplierCart = lazy(() => import("./SupplierCart").then((module) => ({ default: module.SupplierCart })));

export function SupplierPurchasingProvider({ children }: { children: ReactNode }) {
  const { user, actorUser, currentCompany, loading, switchingCompany, impersonationMeta } = useAuth();
  const companyId = !loading && !switchingCompany && user && currentCompany?.status === "ACTIVE" ? currentCompany.id : undefined;
  const identity = getEffectiveIdentityKey({ actorUserId: actorUser?.id ?? null, effectiveUserId: user?.id ?? null, impersonationId: impersonationMeta?.impersonationId ?? null });
  return <PurchasingSession key={`${identity}:${companyId ?? "inactive"}`} companyId={companyId}>{children}</PurchasingSession>;
}

function StartOrder({ companyId, onSelected }: { companyId: string; onSelected: (supplierId: string, versionId: string) => void }) {
  const options = useQuery({ queryKey: ["supplier-comparison-versions", companyId], queryFn: () => fetchSupplierComparisonVersions(companyId) });
  const [supplierId, setSupplierId] = useState("");
  const [versionId, setVersionId] = useState("");
  const suppliers = [...new Map(options.data?.map((option) => [option.supplierId, option.supplierName])).entries()];
  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">Elegí un proveedor y su lista para agregar productos al pedido.</p>
    {options.error ? <p role="alert">No se pudieron cargar las listas. <Button variant="link" onClick={() => void options.refetch()}>Reintentar</Button></p> : null}
    {options.isLoading ? <p>Cargando listas…</p> : null}
    {!options.isLoading && !options.error && !suppliers.length ? <p>No hay listas disponibles. Importá una lista desde Proveedores.</p> : null}
    <Select value={supplierId} onValueChange={(value) => { setSupplierId(value); setVersionId(""); }}><SelectTrigger aria-label="Proveedor del pedido"><SelectValue placeholder="Elegir proveedor" /></SelectTrigger><SelectContent>{suppliers.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select>
    <Select value={versionId} onValueChange={setVersionId} disabled={!supplierId}><SelectTrigger aria-label="Lista del pedido"><SelectValue placeholder="Elegir lista de precios" /></SelectTrigger><SelectContent>{options.data?.filter((option) => option.supplierId === supplierId).map((option) => <SelectItem key={option.id} value={option.id}>{option.listName}</SelectItem>)}</SelectContent></Select>
    <Button disabled={!versionId} onClick={() => onSelected(supplierId, versionId)}>Ver productos</Button>
  </div>;
}

function PurchasingSession({ companyId, children }: { companyId?: string; children: ReactNode }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [items, setItems] = useState<SupplierCartItem[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState<DisplayCurrency>("ARS");
  const exchange = useSupplierExchangeRate(companyId);
  const supplierIds = [...new Set(items.map((item) => item.supplierId))];
  const suppliers = useQueries({ queries: supplierIds.map((supplierId) => ({ queryKey: ["supplier-pricing", companyId, supplierId], queryFn: () => fetchSupplier(companyId!, supplierId), enabled: Boolean(companyId) })) });
  const amounts = items.map((item) => {
    const supplier = suppliers[supplierIds.indexOf(item.supplierId)]?.data;
    const price = supplier && supplierPriceBreakdown(item.line, supplier, currency, exchange.data?.rate);
    return price ? price.total * item.quantity : null;
  });
  const total = supplierMoney(amounts.some((amount) => amount === null) ? null : amounts.reduce<number>((sum, amount) => sum + (amount ?? 0), 0), currency);
  const onNotesChange = useCallback((id: string, value: string) => setNotes((current) => ({ ...current, [id]: value })), []);
  const onPendingChange = useCallback((id: string, value: boolean) => setPending((current) => value ? [...current.filter((entry) => entry !== id), id] : current.filter((entry) => entry !== id)), []);
  const addItem = (item: SupplierCartItem) => {
    if (!companyId) return;
    setItems((current) => addSupplierCartItem(current, item));
    toast({ title: "Producto agregado al carrito", description: item.line.raw_description });
  };
  return <Context.Provider value={companyId ? { items, addItem, open: () => setOpen(true), currency, setCurrency, total } : null}>
    {children}
    {companyId && <EntityDialog open={open} onOpenChange={(value) => { if (!pending.length) setOpen(value); }} title={items.length ? "Carrito de compras" : "Hacer pedido"} contentClassName={items.length ? "max-w-[min(96vw,1280px)]" : undefined}>
      {items.length ? <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><SupplierCurrencyToolbar embedded currency={currency} onCurrencyChange={setCurrency} /><p className="font-semibold" aria-live="polite">Total con IVA y flete: {total}</p></div>
        <Suspense fallback={<p>Cargando carrito…</p>}><SupplierCart companyId={companyId} items={items} currency={currency} rate={exchange.data?.rate} notesBySupplier={notes} onNotesChange={onNotesChange} onPendingChange={onPendingChange} onUpdate={(id, quantity) => setItems((current) => current.map((item) => item.line.id === id ? { ...item, quantity } : item))} onRemove={(id) => setItems((current) => current.filter((item) => item.line.id !== id))} onCreated={(id) => { setItems((current) => current.filter((item) => item.supplierId !== id)); setNotes((current) => { const next = { ...current }; delete next[id]; return next; }); toast({ title: "Orden de compra creada" }); }} /></Suspense>
      </div> : <StartOrder companyId={companyId} onSelected={(supplierId, versionId) => { setOpen(false); navigate(`/suppliers?supplier=${encodeURIComponent(supplierId)}&list=${encodeURIComponent(versionId)}`); }} />}
    </EntityDialog>}
  </Context.Provider>;
}

export function SupplierPurchasingActions() {
  const cart = useSupplierPurchasing();
  const { currentCompany } = useAuth();
  const exchange = useSupplierExchangeRate(cart ? currentCompany?.id : undefined);
  if (!cart) return null;
  return <>
    <Button variant="outline" size="sm" className="tabular-nums" disabled={exchange.isFetching} title={exchange.data ? `Dólar BNA vendedor · ${exchange.data.rateDate}. Actualizar cotización` : "Reintentar cotización BNA"} onClick={() => void exchange.refetch()} aria-label="Actualizar dólar BNA">USD BNA {exchange.data ? `$${exchange.data.rate.toLocaleString("es-AR")}` : exchange.isFetching ? "…" : "No disponible"}</Button>
    <SupplierCartTrigger items={cart.items} onOpen={cart.open} total={cart.total} />
  </>;
}
