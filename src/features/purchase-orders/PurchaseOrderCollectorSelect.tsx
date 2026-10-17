import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';

type Props = { companyId: string; value: string; onChange: (name: string) => void };

export function PurchaseOrderCollectorSelect(props: Props) {
  return <CollectorCombobox key={props.companyId} {...props} />;
}

function CollectorCombobox({ companyId, value, onChange }: Props) {
  const listId = useId();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const options = useQuery({
    queryKey: ['purchase-order-collectors', companyId, search],
    enabled: Boolean(companyId && open),
    queryFn: async () => {
      const escaped = search.trim().replace(/[\\%_]/g, char => '\\' + char);
      const { data, error } = await supabase.from('technicians').select('id,name')
        .eq('company_id', companyId).eq('is_active', true)
        .ilike('name', '%' + escaped + '%').order('name').limit(30);
      if (error) throw error;
      return data;
    },
  });
  const rows = [null, ...(options.data ?? [])];
  const choose = (index: number) => {
    // Keep a name snapshot so historical orders do not change when a technician is edited.
    onChange(rows[index]?.name ?? '');
    setOpen(false);
    setSearch('');
  };
  return <div className="relative" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <Input id="po-collected_by" role="combobox" aria-label="Retira" aria-autocomplete="list"
      aria-expanded={open} aria-controls={listId}
      aria-activedescendant={open ? `${listId}-${Math.min(active, rows.length - 1)}` : undefined}
      placeholder="Seleccionar técnico" value={open ? search : value}
      onFocus={() => { setSearch(''); setActive(0); setOpen(true); }}
      onClick={() => { if (!open) { setSearch(''); setActive(0); setOpen(true); } }}
      onChange={event => { setSearch(event.target.value); setActive(0); setOpen(true); }}
      onKeyDown={event => {
        if (event.key === 'Escape') { setOpen(false); return; }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); setOpen(true);
          setActive(index => Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
        }
        if (event.key === 'Enter' && open) { event.preventDefault(); choose(Math.min(active, rows.length - 1)); }
      }} />
    {open && <div id={listId} role="listbox" aria-label="Técnicos" className="absolute z-50 max-h-60 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
      {rows.map((row, index) => <div key={row?.id ?? 'none'} id={`${listId}-${index}`} role="option"
        aria-selected={row ? row.name === value : !value}
        className={`cursor-pointer rounded-sm px-3 py-2 text-sm ${active === index ? 'bg-accent text-accent-foreground' : ''}`}
        onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(index)}>
        {row?.name ?? 'Sin técnico asignado'}
      </div>)}
      {options.isFetching && <p role="status" className="px-3 py-2 text-sm text-muted-foreground">Buscando técnicos...</p>}
      {!options.isFetching && !options.error && options.data?.length === 0 && <p role="status" className="px-3 py-2 text-sm text-muted-foreground">Sin coincidencias</p>}
    </div>}
    {options.error && <p role="alert" className="text-xs text-destructive">No se pudieron consultar los técnicos. Volvé a abrir la lista para reintentar.</p>}
  </div>;
}
