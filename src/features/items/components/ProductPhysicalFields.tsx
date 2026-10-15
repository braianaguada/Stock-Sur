import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ItemFormState } from '../form';

export function ProductPhysicalFields({ form, onChange }: { form: ItemFormState; onChange: (form: ItemFormState) => void }) {
  return <div className="space-y-3">
    <p className="text-sm font-medium">Peso y medidas fisicas</p>
    <p className="text-xs text-muted-foreground">Son datos fisicos del producto. La unidad de venta se configura por separado.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><Label htmlFor="item-weight">Peso</Label><Input id="item-weight" type="number" min={0} step="any" value={form.weight} onChange={event => onChange({ ...form, weight: event.target.value })} /></div>
      <div><Label>Unidad de peso</Label><Select value={form.weight_unit} onValueChange={value => onChange({ ...form, weight_unit: value })}>
        <SelectTrigger aria-label="Unidad de peso"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="g">Gramos</SelectItem><SelectItem value="kg">Kilogramos</SelectItem></SelectContent>
      </Select></div>
      {([{ key: 'length', label: 'Largo' }, { key: 'width', label: 'Ancho' }, { key: 'height', label: 'Alto' }] as const).map(({ key,label }) => <div key={key}>
        <Label htmlFor={'item-'+key}>{label}</Label><Input id={'item-'+key} type="number" min={0} step="any" value={form[key]} onChange={event => onChange({ ...form, [key]: event.target.value })} />
      </div>)}
      <div><Label>Unidad de medidas</Label><Select value={form.dimension_unit} onValueChange={value => onChange({ ...form, dimension_unit: value })}>
        <SelectTrigger aria-label="Unidad de medidas"><SelectValue /></SelectTrigger><SelectContent>{['mm','cm','m'].map(unit => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}</SelectContent>
      </Select></div>
    </div>
  </div>;
}
