-- Currency belongs to each supplier offer. Supplier/catalog currency fields remain
-- nullable only for backwards compatibility and are not operational fallbacks.

alter table public.supplier_catalog_lines
  add column if not exists currency_raw text,
  add column if not exists currency_detection_source text;

update public.supplier_catalog_lines
set
  currency_raw = coalesce(currency_raw, currency),
  currency = case
    when upper(trim(currency)) in ('USD', 'U$S', 'US$', 'DOLAR', 'DÓLAR', 'DOLARES', 'DÓLARES') then 'USD'
    when currency is null or trim(currency) = '' or upper(trim(currency)) in ('ARS', '$', 'PESO', 'PESOS') then 'ARS'
    else upper(trim(currency))
  end,
  currency_detection_source = coalesce(currency_detection_source, 'LEGACY')
where currency_raw is null
   or currency_detection_source is null
   or currency is distinct from upper(trim(currency));

do $$
begin
  if exists (
    select 1 from public.supplier_catalog_lines where currency not in ('ARS', 'USD')
  ) then
    raise exception 'supplier_catalog_lines contains unsupported currencies; review them before applying this migration';
  end if;
end
$$;

alter table public.supplier_catalog_lines
  drop constraint if exists supplier_catalog_lines_currency_check,
  drop constraint if exists supplier_catalog_lines_currency_detection_source_check;

alter table public.supplier_catalog_lines
  add constraint supplier_catalog_lines_currency_check
    check (currency in ('ARS', 'USD')),
  add constraint supplier_catalog_lines_currency_detection_source_check
    check (
      currency_detection_source is null
      or currency_detection_source in ('PRICE_CELL', 'CURRENCY_COLUMN', 'PRICE_HEADER', 'MANUAL', 'DEFAULT_ARS', 'LEGACY')
    );

create or replace function public.normalize_supplier_offer_currency()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_raw text := trim(coalesce(new.currency, ''));
begin
  new.currency_raw := coalesce(new.currency_raw, nullif(v_raw, ''));
  new.currency_detection_source := coalesce(new.currency_detection_source, 'LEGACY');

  if v_raw = '' or upper(v_raw) in ('ARS', '$', 'PESO', 'PESOS') then
    new.currency := 'ARS';
  elsif upper(v_raw) in ('USD', 'U$S', 'US$', 'DOLAR', 'DÓLAR', 'DOLARES', 'DÓLARES') then
    new.currency := 'USD';
  else
    raise exception 'Moneda de oferta no soportada: %', v_raw using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists normalize_supplier_offer_currency_before_write on public.supplier_catalog_lines;
create trigger normalize_supplier_offer_currency_before_write
before insert or update of currency on public.supplier_catalog_lines
for each row execute function public.normalize_supplier_offer_currency();

comment on column public.suppliers.default_currency is
  'Preferencia legacy opcional. No debe usarse para inferir la moneda de ofertas.';
comment on column public.supplier_catalogs.currency is
  'Clasificacion legacy opcional. La composicion monetaria se deriva de las lineas.';
comment on column public.supplier_catalog_versions.currency is
  'Snapshot legacy opcional. Una version puede contener lineas ARS y USD.';
comment on column public.supplier_catalog_lines.currency is
  'Moneda canonica de la oferta individual. Fuente de verdad: ARS o USD.';
