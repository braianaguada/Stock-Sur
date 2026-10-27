import { useId } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LineDraft } from "../types";
import { recalculateManualQuote } from "../lib/manual-quote";

type Props = {
  line: LineDraft;
  onChange: (line: LineDraft) => void;
  onRemove: () => void;
  formatMoney: (value: number) => string;
};

export function ManualQuoteLineEditor({ line, onChange, onRemove, formatMoney }: Props) {
  const id = useId();
  const calculate = (patch: Partial<LineDraft>) => onChange(recalculateManualQuote({ ...line, ...patch }));
  const numberField = (label: string, suffix: string, value: number, change: (value: number) => void, min = 0) => (
    <div className="min-w-0 space-y-1">
      <Label htmlFor={`${id}-${suffix}`}>{label}</Label>
      <Input id={`${id}-${suffix}`} type="number" min={min} step="any" value={Number.isFinite(value) ? value : ""}
        onChange={(event) => change(event.target.valueAsNumber)} />
    </div>
  );
  return (
    <fieldset className="min-w-0 space-y-3 rounded-lg border border-border/70 bg-background/80 p-3">
      <legend className="px-1 text-sm font-semibold">Producto manual</legend>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_8rem_auto] sm:items-end">
        <div className="min-w-0 space-y-1">
          <Label htmlFor={`${id}-description`}>Descripcion</Label>
          <Input id={`${id}-description`} value={line.description} placeholder="Producto a cotizar"
            onChange={(event) => onChange({ ...line, description: event.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-unit`}>Unidad</Label>
          <Input id={`${id}-unit`} value={line.unit} onChange={(event) => onChange({ ...line, unit: event.target.value })} />
        </div>
        {numberField("Cantidad", "quantity", line.quantity, (quantity) => onChange({ ...line, quantity }), 0.001)}
        <Button type="button" variant="ghost" size="icon" aria-label={`Eliminar producto manual ${line.description}`} onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {numberField("Costo unitario sin IVA ($)", "cost", line.base_cost_snapshot ?? 0, (base_cost_snapshot) => calculate({ base_cost_snapshot }))}
        {numberField("Flete %", "freight", line.list_flete_pct_snapshot ?? 0, (list_flete_pct_snapshot) => calculate({ list_flete_pct_snapshot }))}
        {numberField("Recargo %", "margin", line.manual_margin_pct ?? line.list_utilidad_pct_snapshot ?? 0, (manual_margin_pct) => calculate({ manual_margin_pct }))}
        <div className="space-y-1"><Label htmlFor={`${id}-vat`}>IVA %</Label><Input id={`${id}-vat`} value="21" readOnly /></div>
        {numberField("Precio final unitario ($)", "price", line.unit_price, (unit_price) => onChange({ ...line, unit_price, pricing_mode: "MANUAL_PRICE" }))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">Costo + flete, luego recargo e IVA. Importes en pesos.</span>
        <div className="flex flex-wrap items-center gap-3">
          {line.pricing_mode === "MANUAL_PRICE" ? <Button type="button" size="sm" variant="outline" onClick={() => calculate({})}>Usar precio calculado</Button> : null}
          <strong>Total: {formatMoney(line.quantity * line.unit_price)}</strong>
        </div>
      </div>
    </fieldset>
  );
}
