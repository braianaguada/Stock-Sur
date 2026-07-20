import { useDeferredValue, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronUp, Search, ShoppingCart, X } from "lucide-react";
import { CountBadge } from "@/components/common/VisualSystem";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SupplierOfferPrice } from "@/features/suppliers/components/SupplierOfferPrice";
import { groupComparisonSelectionBySupplier, normalizeComparisonSearch, type RankedComparisonOffer, type SupplierComparisonGroup, type SupplierComparisonOffer } from "@/features/suppliers/comparison/domain";
import { useSupplierComparison } from "@/features/suppliers/comparison/useSupplierComparison";

export function SupplierComparison({
  companyId,
  onSelectOffer,
  onRemoveOffer,
  onClearSelection,
  selectedOffers = [],
}: {
  companyId: string | null;
  onSelectOffer: (offer: SupplierComparisonOffer) => void;
  onRemoveOffer: (offerId: string) => void;
  onClearSelection: () => void;
  selectedOffers?: SupplierComparisonOffer[];
}) {
  const [versionIds, setVersionIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [fxInput, setFxInput] = useState("");
  const parsedFx = Number(fxInput.replace(",", "."));
  const usdToArs = Number.isFinite(parsedFx) && parsedFx > 0 ? parsedFx : null;
  const deferredSearch = useDeferredValue(search);
  const searchReady = normalizeComparisonSearch(deferredSearch).length >= 2;
  const { versionsQuery, offersQuery, groups } = useSupplierComparison(companyId, versionIds, deferredSearch, usdToArs);
  const selectedIds = useMemo(() => new Set(selectedOffers.map((offer) => offer.id)), [selectedOffers]);

  const toggleVersion = (versionId: string, checked: boolean) => {
    setVersionIds((current) => checked ? [...current, versionId] : current.filter((id) => id !== versionId));
  };

  return (
    <section className="space-y-5" aria-labelledby="supplier-comparison-title">
      <header>
        <h2 id="supplier-comparison-title" className="text-lg font-semibold">Comparar ofertas</h2>
        <p className="mt-1 text-sm text-muted-foreground">Elegí listas de distintos proveedores y compará coincidencias exactas sin perder el precio original.</p>
      </header>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-medium">Listas incluidas</h3>
            <p className="text-xs text-muted-foreground">Seleccioná al menos dos listas para una comparación útil.</p>
          </div>
          {versionIds.length > 0 ? <CountBadge>{versionIds.length} seleccionadas</CountBadge> : null}
        </div>
        {versionsQuery.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Cargando listas…</p> : null}
        {versionsQuery.isError ? <p role="alert" className="mt-4 text-sm text-destructive">No pudimos cargar las listas. Volvé a intentar.</p> : null}
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {(versionsQuery.data ?? []).map((version) => {
            const checkboxId = `comparison-version-${version.id}`;
            return (
              <label key={version.id} htmlFor={checkboxId} className="flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40 has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-primary/5">
                <Checkbox id={checkboxId} checked={versionIds.includes(version.id)} onCheckedChange={(value) => toggleVersion(version.id, value === true)} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium" title={version.listName}>{version.listName}</span>
                  <span className="block truncate text-xs text-muted-foreground" title={version.supplierName}>{version.supplierName}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{new Date(version.importedAt).toLocaleDateString("es-AR")}</span>
                </span>
              </label>
            );
          })}
        </div>
        {!versionsQuery.isLoading && (versionsQuery.data ?? []).length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Todavía no hay listas activas disponibles.</p> : null}
      </div>

      {versionIds.length > 0 ? (
        <div className="grid gap-3 rounded-xl border bg-card p-4 lg:grid-cols-[minmax(16rem,1fr)_minmax(15rem,22rem)] lg:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="supplier-comparison-search">Buscar producto</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input id="supplier-comparison-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar producto en las listas seleccionadas..." className="pl-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="supplier-comparison-fx">Tipo de cambio (1 USD en ARS)</Label>
            <Input id="supplier-comparison-fx" inputMode="decimal" value={fxInput} onChange={(event) => setFxInput(event.target.value)} placeholder="Opcional, por ejemplo 1450" aria-describedby="supplier-comparison-fx-help" />
            <p id="supplier-comparison-fx-help" className="text-xs text-muted-foreground">Solo ordena una referencia convertida; el precio original no cambia.</p>
          </div>
        </div>
      ) : null}

      {selectedOffers.length > 0 ? <ComparisonTray offers={selectedOffers} onRemove={onRemoveOffer} onClear={onClearSelection} /> : null}
      {versionIds.length > 0 && !searchReady ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Escribí al menos 2 caracteres para buscar solo dentro de las listas seleccionadas.</div> : null}
      {offersQuery.isLoading && searchReady ? <div className="rounded-xl border p-10 text-center text-sm text-muted-foreground">Buscando ofertas…</div> : null}
      {offersQuery.isError ? <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">No pudimos cargar las ofertas seleccionadas.</div> : null}
      {!offersQuery.isLoading && searchReady && groups.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">No encontramos coincidencias</p>
          <p className="mt-1 text-sm text-muted-foreground">Probá otra búsqueda o seleccioná otras listas. No unimos descripciones parecidas automáticamente.</p>
        </div>
      ) : null}
      <div className="space-y-3">
        {groups.map((group) => (
          <ComparisonGroup key={group.id} group={group} hasFx={usdToArs !== null} selectedIds={selectedIds} onSelectOffer={onSelectOffer} />
        ))}
      </div>
    </section>
  );
}

function ComparisonTray({ offers, onRemove, onClear }: {
  offers: SupplierComparisonOffer[];
  onRemove: (offerId: string) => void;
  onClear: () => void;
}) {
  const groups = useMemo(() => groupComparisonSelectionBySupplier(offers), [offers]);
  return (
    <section className="rounded-xl border border-primary/30 bg-primary/5 p-4" aria-labelledby="comparison-tray-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="comparison-tray-title" className="flex items-center gap-2 font-semibold"><ShoppingCart className="size-4" />Bandeja de compra</h3>
          <p className="mt-1 text-xs text-muted-foreground">La selección se conserva mientras seguís buscando y se agrupa por proveedor.</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>Vaciar bandeja</Button>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {groups.map((group) => (
          <article key={group.supplierId} className="min-w-0 rounded-lg border bg-background p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><h4 className="font-medium">{group.supplierName}</h4><p className="text-xs text-muted-foreground">{group.offers.length} {group.offers.length === 1 ? "producto" : "productos"}</p></div>
              <div className="text-right text-xs font-medium tabular-nums">
                {(["ARS", "USD"] as const).map((currency) => group.totals[currency] !== undefined ? <div key={currency}>{currency} {group.totals[currency]!.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div> : null)}
              </div>
            </div>
            <div className="mt-3 divide-y">
              {group.offers.map((offer) => (
                <div key={offer.id} className="flex items-start gap-2 py-2 text-xs">
                  <span className="min-w-0 flex-1"><span className="block break-words">{offer.description}</span><span className="text-muted-foreground">{taxTreatmentLabel(offer.taxTreatment)} · {offer.currency} {offer.cost.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
                  <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => onRemove(offer.id)} aria-label={`Quitar ${offer.description}`}><X className="size-4" /></Button>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function taxTreatmentLabel(treatment: SupplierComparisonOffer["taxTreatment"]) {
  if (treatment === "INCLUDED") return "IVA incluido";
  if (treatment === "EXCLUDED") return "Más IVA";
  return "IVA no informado";
}

function ComparisonGroup({ group, hasFx, selectedIds, onSelectOffer }: {
  group: SupplierComparisonGroup;
  hasFx: boolean;
  selectedIds: Set<string>;
  onSelectOffer: (offer: SupplierComparisonOffer) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleOffers = expanded ? group.offers : group.offers.slice(0, 5);
  const currencies = new Set(group.offers.map((offer) => offer.currency));
  return (
    <article className="overflow-hidden rounded-xl border bg-card">
      <header className="border-b bg-muted/20 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="break-words font-semibold leading-snug">{group.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {group.matchKind === "MATCHED_ITEM" ? "Vínculo confirmado con el producto" : "Coincidencia exacta de descripción normalizada"}
            </p>
          </div>
          <CountBadge>{group.offers.length} {group.offers.length === 1 ? "oferta" : "ofertas"}</CountBadge>
        </div>
        {currencies.size > 1 && !hasFx ? (
          <p className="mt-3 flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            ARS y USD se ordenan por separado. Falta tipo de cambio para compararlas.
          </p>
        ) : null}
        {!group.taxComparable ? (
          <p className="mt-3 flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            Comparación fiscal pendiente: las ofertas tienen distinto tratamiento de IVA o no lo informan.
          </p>
        ) : null}
      </header>
      <div className="divide-y" role="list" aria-label={`Ofertas para ${group.title}`}>
        {visibleOffers.map((offer) => (
          <ComparisonOfferRow key={offer.id} offer={offer} hasFx={hasFx} taxComparable={group.taxComparable} selected={selectedIds.has(offer.id)} onSelect={() => onSelectOffer(offer)} />
        ))}
      </div>
      {group.offers.length > 5 ? (
        <Button type="button" variant="ghost" className="h-10 w-full rounded-none border-t text-xs" onClick={() => setExpanded((current) => !current)}>
          {expanded ? <ChevronUp className="mr-2 size-4" /> : <ChevronDown className="mr-2 size-4" />}
          {expanded ? "Ver menos" : `Ver ${group.offers.length - 5} ofertas más`}
        </Button>
      ) : null}
    </article>
  );
}

function ComparisonOfferRow({ offer, hasFx, taxComparable, selected, onSelect }: { offer: RankedComparisonOffer; hasFx: boolean; taxComparable: boolean; selected: boolean; onSelect: () => void }) {
  return (
    <div className="grid gap-3 px-4 py-3 sm:px-5 md:grid-cols-[minmax(12rem,1fr)_minmax(9rem,auto)_minmax(9rem,auto)_auto] md:items-center" role="listitem">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium" title={offer.supplierName}>{offer.supplierName}</p>
        <p className="truncate text-xs text-muted-foreground" title={offer.listName}>{offer.listName}{offer.supplierCode ? ` · Cód. ${offer.supplierCode}` : ""}</p>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground" title={offer.description}>{offer.description}</p>
        <p className="mt-1 text-xs font-medium text-muted-foreground">{taxTreatmentLabel(offer.taxTreatment)}</p>
      </div>
      <div className="md:text-right">
        <SupplierOfferPrice value={offer.cost} currency={offer.currency} />
        {hasFx && offer.currency === "USD" && offer.arsReference !== null ? <p className="mt-0.5 whitespace-nowrap text-xs tabular-nums text-muted-foreground">Ref. ARS {offer.arsReference.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p> : null}
      </div>
      <div className="text-xs md:text-right">
        {!taxComparable ? <span className="font-medium text-amber-700 dark:text-amber-300">Revisar IVA antes de comparar</span> : hasFx && offer.referenceRank !== null ? (
          offer.referenceRank === 1
            ? <span className="font-medium text-emerald-700 dark:text-emerald-300">Mejor precio convertido</span>
            : <span className="tabular-nums text-muted-foreground">+{(offer.referenceDifferencePercent ?? 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% convertido</span>
        ) : offer.rank === 1 ? <span className="font-medium text-emerald-700 dark:text-emerald-300">Mejor precio en {offer.currency}</span> : <span className="tabular-nums text-muted-foreground">+{offer.differencePercent.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% en {offer.currency}</span>}
      </div>
      <Button type="button" variant={selected ? "secondary" : "outline"} className="w-full md:w-auto" onClick={onSelect} disabled={selected}>
        {selected ? <><Check className="mr-2 size-4" />Seleccionada</> : "Seleccionar"}
      </Button>
    </div>
  );
}
