import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function ItemSupplierSelect({ companyId, value, onChange }: {
  companyId: string; value: string; onChange: (id: string, name: string) => void;
}) {
  const [search, setSearch] = useState('');
  const options = useQuery({
    queryKey: ['item-supplier-options', companyId, search], enabled: Boolean(companyId),
    queryFn: async () => {
      const escaped = search.trim().replace(/[\\%_]/g, char => '\\' + char);
      const { data, error } = await supabase.from('suppliers').select('id,name').eq('company_id',companyId)
        .eq('is_active',true).ilike('name','%' + escaped + '%').order('name').limit(30);
      if (error) throw error;
      return data;
    },
  });
  const selected = useQuery({
    queryKey: ['item-supplier-option', companyId, value], enabled: Boolean(companyId && value),
    queryFn: async () => {
      const { data, error } = await supabase.from('suppliers').select('id,name').eq('company_id',companyId).eq('id',value).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const rows = [...(options.data ?? [])];
  if (selected.data && !rows.some(row => row.id === selected.data.id)) rows.push(selected.data);
  return <div className="space-y-2">
    <Input aria-label="Buscar proveedor" placeholder="Buscar proveedor por nombre" value={search} onChange={event => setSearch(event.target.value)} />
    <Select value={value || 'none'} onValueChange={id => onChange(id === 'none' ? '' : id, rows.find(row => row.id === id)?.name ?? '')}>
      <SelectTrigger aria-label="Proveedor asociado"><SelectValue placeholder="Seleccionar proveedor" /></SelectTrigger>
      <SelectContent><SelectItem value="none">Sin proveedor asociado</SelectItem>{rows.map(row => <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>)}</SelectContent>
    </Select>
    {options.isLoading && <p className="text-xs text-muted-foreground">Buscando proveedores...</p>}
    {(options.error || selected.error) && <p role="alert" className="text-xs text-destructive">No se pudieron consultar proveedores. Revisa tu permiso de proveedores y vuelve a abrir la ficha.</p>}
  </div>;
}
