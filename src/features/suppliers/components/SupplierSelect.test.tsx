import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SupplierSelect } from './SupplierSelect';

const mocks = vi.hoisted(() => ({ calls: [] as Array<Record<string, unknown>>, rows: [{ id: 's1', name: 'Proveedor Uno', address: 'San Martin 123' }] }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => {
  const filters: Record<string, unknown> = {};
  const query = {
    select: (fields: string) => { filters.fields = fields; return query; },
    eq: (key: string, value: unknown) => { filters[key] = value; return query; },
    ilike: (_key: string, value: string) => { filters.search = value; return query; },
    order: () => query,
    limit: async () => { mocks.calls.push({ ...filters }); return { data: mocks.rows, error: null }; },
    maybeSingle: async () => { mocks.calls.push({ ...filters }); return { data: mocks.rows.find(row => row.id === filters.id) ?? null, error: null }; },
  };
  return query;
} } }));

function setup(value = '') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onChange = vi.fn();
  const view = render(<QueryClientProvider client={client}><SupplierSelect companyId="c1" value={value} onChange={onChange} /></QueryClientProvider>);
  return { ...view, client, onChange };
}

describe('SupplierSelect', () => {
  beforeEach(() => { mocks.calls.length = 0; });
  it('uses one searchable field and returns the registered address, never arbitrary text', async () => {
    const { onChange } = setup();
    const input = screen.getByRole('combobox');
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Uno' } });
    fireEvent.click(await screen.findByRole('option', { name: 'Proveedor Uno' }));
    expect(onChange).toHaveBeenCalledWith('s1', 'Proveedor Uno', 'San Martin 123');
    expect(mocks.calls).toContainEqual(expect.objectContaining({ company_id: 'c1', is_active: true, search: '%Uno%', fields: 'id,name,address' }));
  });
  it('supports keyboard selection and clearing the association', async () => {
    const { onChange } = setup('s1');
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('Proveedor Uno'));
    fireEvent.focus(screen.getByRole('combobox'));
    await screen.findByRole('option', { name: 'Proveedor Uno' });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('s1', 'Proveedor Uno', 'San Martin 123');
    fireEvent.focus(screen.getByRole('combobox'));
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('', '', '');
  });
  it('discards search and options when changing company', async () => {
    const view = setup();
    fireEvent.focus(screen.getByRole('combobox'));
    await screen.findByRole('option', { name: 'Proveedor Uno' });
    view.rerender(<QueryClientProvider client={view.client}><SupplierSelect companyId="c2" value="" onChange={view.onChange} /></QueryClientProvider>);
    expect(screen.getByRole('combobox')).toHaveValue('');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    fireEvent.focus(screen.getByRole('combobox'));
    await screen.findByRole('option', { name: 'Proveedor Uno' });
    expect(mocks.calls).toContainEqual(expect.objectContaining({ company_id: 'c2' }));
  });
});
