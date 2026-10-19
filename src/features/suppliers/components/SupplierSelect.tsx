import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';

type Supplier = { id: string; name: string; address: string | null };
type Props = { companyId: string; value: string; onChange: (id: string, name: string, address: string) => void };

export function SupplierSelect(props: Props) {
  return <SupplierCombobox key={props.companyId} {...props} />;
}

function SupplierCombobox({ companyId, value, onChange }: Props) {
  const listId = useId();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const options = useQuery({
    queryKey: ['registered-supplier-options', companyId, search], enabled: Boolean(companyId && open),
    queryFn: async () => {
      const escaped = search.trim().replace(/[\\%_]/g, char => '\\' + char);
      const { data, error } = await supabase.from('suppliers').select('id,name,address').eq('company_id', companyId)
        .eq('is_active', true).ilike('name', '%' + escaped + '%').order('name').limit(30);
      if (error) throw error;
      return data as Supplier[];
    },
  });
  const selected = useQuery({
    queryKey: ['registered-supplier-option', companyId, value], enabled: Boolean(companyId && value),
    queryFn: async () => {
      const { data, error } = await supabase.from('suppliers').select('id,name,address').eq('company_id', companyId).eq('id', value).maybeSingle();
      if (error) throw error;
      return data as Supplier | null;
    },
  });
  const rows: Array<Supplier | null> = [null, ...(options.data ?? [])];
  const choose = (row: Supplier | null) => {
    onChange(row?.id ?? '', row?.name ?? '', row?.address ?? '');
    setOpen(false); setSearch('');
  };
  return <div className="relative space-y-2" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <Input role="combobox" aria-label="Proveedor asociado" aria-autocomplete="list" aria-expanded={open}
      aria-controls={listId} aria-activedescendant={open ? `${listId}-${active}` : undefined}
      placeholder={selected.isLoading ? 'Cargando proveedor...' : 'Seleccionar proveedor'}
      value={open ? search : selected.data?.name ?? ''}
      onFocus={() => { setSearch(''); setActive(0); setOpen(true); }}
      onClick={() => { if (!open) { setSearch(''); setActive(0); setOpen(true); } }}
      onChange={event => { setSearch(event.target.value); setActive(0); setOpen(true); }}
      onKeyDown={event => {
        if (event.key === 'Escape') { setOpen(false); return; }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); setOpen(true);
          setActive(index => Math.max(0, Math.min(rows.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
        }
        if (event.key === 'Enter' && open) { event.preventDefault(); choose(rows[active] ?? null); }
      }} />
    {open && <div id={listId} role="listbox" aria-label="Proveedores" className="absolute z-50 max-h-60 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
      {rows.map((row, index) => <div key={row?.id ?? 'none'} id={`${listId}-${index}`} role="option"
        aria-selected={(row?.id ?? '') === value} className={`cursor-pointer rounded-sm px-3 py-2 text-sm ${active === index ? 'bg-accent text-accent-foreground' : ''}`}
        onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(row)}>
        {row?.name ?? 'Sin proveedor asociado'}
      </div>)}
      {options.isFetching && <p role="status" className="px-3 py-2 text-sm text-muted-foreground">Buscando proveedores...</p>}
      {!options.isFetching && !options.error && options.data?.length === 0 && <p role="status" className="px-3 py-2 text-sm text-muted-foreground">Sin coincidencias</p>}
    </div>}
    {(options.error || selected.error) && <p role="alert" className="text-xs text-destructive">No se pudieron consultar proveedores. Revisa tu permiso de proveedores y vuelve a abrir la ficha.</p>}
  </div>;
}
