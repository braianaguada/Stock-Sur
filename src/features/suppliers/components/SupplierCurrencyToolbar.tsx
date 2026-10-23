import { Button } from "@/components/ui/button";
import { FilterToolbar } from "@/components/ui/page";
import type { DisplayCurrency } from "../pricing";

export function SupplierCurrencyToolbar({ currency, onCurrencyChange, embedded = false }: {
  currency: DisplayCurrency; onCurrencyChange: (value: DisplayCurrency) => void;
  embedded?: boolean;
}) {
  return <FilterToolbar className={embedded ? "border-0 bg-transparent p-0 shadow-none" : undefined}>
    <div className="flex items-center gap-2"><span className="text-sm">Ver precios en</span>{(["ARS", "USD"] as const).map((value) => <Button key={value} size="sm" variant={currency === value ? "default" : "outline"} aria-pressed={currency === value} onClick={() => onCurrencyChange(value)}>{value}</Button>)}</div>
  </FilterToolbar>;
}
