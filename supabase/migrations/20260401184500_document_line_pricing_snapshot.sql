alter table public.document_lines
  add column if not exists pricing_mode text not null default 'MANUAL_PRICE',
  add column if not exists suggested_unit_price numeric(14,2) not null default 0,
  add column if not exists base_cost_snapshot numeric(14,2) null,
  add column if not exists list_flete_pct_snapshot numeric(8,4) null,
  add column if not exists list_utilidad_pct_snapshot numeric(8,4) null,
  add column if not exists list_impuesto_pct_snapshot numeric(8,4) null,
  add column if not exists manual_margin_pct numeric(8,4) null,
  add column if not exists price_overridden_by uuid null references auth.users(id),
  add column if not exists price_overridden_at timestamptz null;

alter table public.document_lines
  drop constraint if exists document_lines_pricing_mode_check;

alter table public.document_lines
  add constraint document_lines_pricing_mode_check
  check (pricing_mode in ('LIST_PRICE', 'MANUAL_MARGIN', 'MANUAL_PRICE'));

update public.document_lines
set
  pricing_mode = case
    when pricing_mode is null or pricing_mode = '' then 'MANUAL_PRICE'
    else pricing_mode
  end,
  suggested_unit_price = coalesce(suggested_unit_price, unit_price)
where true;

notify pgrst, 'reload schema';
