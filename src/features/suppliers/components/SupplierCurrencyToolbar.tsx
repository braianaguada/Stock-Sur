import type { useSupplierExchangeRate } from "../hooks/useSupplierExchangeRate";
import { Button } from "@/components/ui/button";
import { FilterToolbar } from "@/components/ui/page";
import type { DisplayCurrency } from "../pricing";

export function SupplierCurrencyToolbar({ currency, onCurrencyChange, exchange }: {
  currency: DisplayCurrency; onCurrencyChange: (value: DisplayCurrency) => void;
  exchange: ReturnType<typeof useSupplierExchangeRate>;
}) {
  return <FilterToolbar>
    <div className="flex items-center gap-2"><span className="text-sm">Ver precios en</span>{(["ARS", "USD"] as const).map((value) => <Button key={value} size="sm" variant={currency === value ? "default" : "outline"} aria-pressed={currency === value} onClick={() => onCurrencyChange(value)}>{value}</Button>)}</div>
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span aria-live="polite">{exchange.isFetching ? "Consultando BNA…" : exchange.error ? "No se pudo obtener el dólar BNA. La conversión no está disponible." : exchange.data ? `BNA vendedor · ARS ${exchange.data.rate.toLocaleString("es-AR")} · ${exchange.data.rateDate}` : "Cotización pendiente"}</span>
      <Button size="sm" variant="ghost" disabled={exchange.isFetching} onClick={() => void exchange.refetch()}>Actualizar cotización</Button>
    </div>
  </FilterToolbar>;
}
