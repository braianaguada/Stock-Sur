import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PurchaseOrderCollectorSelect } from './PurchaseOrderCollectorSelect';

const mocks = vi.hoisted(() => ({ from: vi.fn(), eq: vi.fn(), ilike: vi.fn(), limit: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));

function setup(value = '') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onChange = vi.fn();
  const renderPicker = (companyId: string) => <QueryClientProvider client={client}><PurchaseOrderCollectorSelect companyId={companyId} value={value} onChange={onChange} /></QueryClientProvider>;
  return { ...render(renderPicker('company-1')), onChange, renderPicker };
}

describe('purchase order collector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const chain = { select: vi.fn().mockReturnThis(), eq: mocks.eq, ilike: mocks.ilike, order: vi.fn().mockReturnThis(), limit: mocks.limit };
    mocks.eq.mockReturnValue(chain);
    mocks.ilike.mockReturnValue(chain);
    mocks.from.mockReturnValue(chain);
    mocks.limit.mockResolvedValue({ data: [{ id: 'tech-1', name: 'Carlos' }], error: null });
  });

  it('queries only active technicians of the company and saves the selected name', async () => {
    const view = setup();
    expect(mocks.from).not.toHaveBeenCalled();
    fireEvent.focus(screen.getByRole('combobox', { name: 'Retira' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Carlos' }));
    expect(mocks.from).toHaveBeenCalledWith('technicians');
    expect(mocks.eq).toHaveBeenCalledWith('company_id', 'company-1');
    expect(mocks.eq).toHaveBeenCalledWith('is_active', true);
    expect(mocks.limit).toHaveBeenCalledWith(30);
    expect(view.onChange).toHaveBeenCalledWith('Carlos');
  });

  it('escapes search wildcards and supports keyboard selection without submitting', async () => {
    const view = setup();
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Car_%' } });
    await screen.findByRole('option', { name: 'Carlos' });
    expect(mocks.ilike).toHaveBeenCalledWith('name', '%Car\\_\\%%');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(view.onChange).toHaveBeenCalledWith('Carlos');
  });

  it('preserves legacy names and lets the operator clear the selection', async () => {
    const view = setup('Nombre histórico');
    expect(screen.getByRole('combobox')).toHaveValue('Nombre histórico');
    fireEvent.focus(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'Sin técnico asignado' }));
    expect(view.onChange).toHaveBeenCalledWith('');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  });

  it('clears open search and uses a different cache when switching company', async () => {
    const view = setup();
    fireEvent.focus(screen.getByRole('combobox'));
    await screen.findByRole('option', { name: 'Carlos' });
    view.rerender(view.renderPicker('company-2'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    mocks.limit.mockResolvedValue({ data: [], error: null });
    fireEvent.focus(screen.getByRole('combobox'));
    await screen.findByText('Sin coincidencias');
    expect(screen.queryByRole('option', { name: 'Carlos' })).not.toBeInTheDocument();
    expect(mocks.eq).toHaveBeenCalledWith('company_id', 'company-2');
  });

  it('shows query errors without changing the saved collector', async () => {
    mocks.limit.mockResolvedValue({ data: null, error: new Error('denied') });
    const view = setup('Carlos');
    fireEvent.focus(screen.getByRole('combobox'));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron consultar');
    expect(view.onChange).not.toHaveBeenCalled();
  });
});
