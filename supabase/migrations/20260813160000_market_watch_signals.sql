create table public.market_watch_signals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  item_id uuid null references public.items(id) on delete set null,
  title text not null,
  source_name text not null,
  source_url text not null,
  signal_type text not null default 'DEMAND',
  observed_price numeric(14, 2) null,
  currency text not null default 'ARS',
  notes text null,
  observed_at date not null default current_date,
  is_active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_watch_signals_title_length check (char_length(btrim(title)) between 2 and 160),
  constraint market_watch_signals_source_name_length check (char_length(btrim(source_name)) between 2 and 100),
  constraint market_watch_signals_source_url_http check (source_url ~* '^https?://'),
  constraint market_watch_signals_type_check check (signal_type in ('DEMAND', 'NOVELTY', 'COMPETITOR', 'PRICE')),
  constraint market_watch_signals_price_check check (observed_price is null or observed_price >= 0),
  constraint market_watch_signals_currency_check check (currency ~ '^[A-Z]{3}$')
);

create index market_watch_signals_company_observed_idx
  on public.market_watch_signals(company_id, observed_at desc)
  where is_active;

create index market_watch_signals_company_item_idx
  on public.market_watch_signals(company_id, item_id)
  where item_id is not null and is_active;

create or replace function public.set_market_watch_signals_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.company_id is distinct from old.company_id or new.created_by is distinct from old.created_by then
    raise exception 'No se puede cambiar la empresa ni el creador de una señal de mercado';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger market_watch_signals_set_updated_at
before update on public.market_watch_signals
for each row execute function public.set_market_watch_signals_updated_at();

alter table public.market_watch_signals enable row level security;

create policy "market_watch_signals_select"
on public.market_watch_signals for select to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'stock.view')
);

create policy "market_watch_signals_insert"
on public.market_watch_signals for insert to authenticated
with check (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'stock.edit')
  and created_by = auth.uid()
  and (
    item_id is null
    or exists (
      select 1 from public.items i
      where i.id = item_id and i.company_id = market_watch_signals.company_id
    )
  )
);

create policy "market_watch_signals_update"
on public.market_watch_signals for update to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'stock.edit')
)
with check (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'stock.edit')
  and (
    item_id is null
    or exists (
      select 1 from public.items i
      where i.id = item_id and i.company_id = market_watch_signals.company_id
    )
  )
);

create policy "market_watch_signals_delete"
on public.market_watch_signals for delete to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'stock.edit')
);

grant select, insert, update, delete on public.market_watch_signals to authenticated;
