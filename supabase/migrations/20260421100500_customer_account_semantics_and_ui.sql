create or replace function public.register_customer_account_debit_from_cash_sale(
  p_company_id uuid,
  p_customer_id uuid,
  p_cash_sale_id uuid,
  p_amount numeric(14,2) default null,
  p_description text default null,
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.customer_account_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.cash_sales%rowtype;
begin
  select *
  into v_sale
  from public.cash_sales
  where id = p_cash_sale_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'Venta no encontrada';
  end if;

  if v_sale.customer_id is null then
    raise exception 'La cuenta corriente requiere cliente identificado';
  end if;

  if v_sale.customer_id <> p_customer_id then
    raise exception 'El cliente de la venta no coincide';
  end if;

  if v_sale.payment_method <> 'CUENTA_CORRIENTE' then
    raise exception 'Solo se puede debitar desde una venta a cuenta corriente';
  end if;

  return public.record_customer_account_entry(
    p_company_id,
    p_customer_id,
    'DEBIT',
    'CASH_SALE',
    p_cash_sale_id,
    coalesce(p_amount, v_sale.amount_total),
    coalesce(p_description, 'Venta fiada en caja'),
    v_sale.business_date,
    p_notes,
    p_metadata,
    null,
    p_cash_sale_id
  );
end;
$$;
create or replace function public.register_customer_account_credit_from_cash_sale(
  p_company_id uuid,
  p_customer_id uuid,
  p_cash_sale_id uuid,
  p_amount numeric(14,2) default null,
  p_description text default null,
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.customer_account_entries
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.register_customer_account_debit_from_cash_sale(
    p_company_id,
    p_customer_id,
    p_cash_sale_id,
    p_amount,
    p_description,
    p_notes,
    p_metadata
  );
end;
$$;
create or replace function public.list_customer_account_entries(
  p_company_id uuid,
  p_customer_id uuid,
  p_limit integer default 100
)
returns table (
  id uuid,
  company_id uuid,
  customer_id uuid,
  entry_type public.customer_account_entry_type,
  origin_type public.customer_account_origin_type,
  origin_id uuid,
  document_id uuid,
  cash_sale_id uuid,
  amount numeric(14,2),
  currency text,
  business_date date,
  description text,
  notes text,
  metadata jsonb,
  created_by uuid,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    e.id,
    e.company_id,
    e.customer_id,
    e.entry_type,
    e.origin_type,
    e.origin_id,
    e.document_id,
    e.cash_sale_id,
    e.amount,
    e.currency,
    e.business_date,
    e.description,
    e.notes,
    e.metadata,
    e.created_by,
    e.created_at
  from public.customer_account_entries e
  where e.company_id = p_company_id
    and e.customer_id = p_customer_id
  order by e.business_date desc, e.created_at desc, e.id desc
  limit greatest(coalesce(p_limit, 100), 1);
$$;
create or replace view public.customer_account_summary as
select
  e.company_id,
  e.customer_id,
  coalesce(sum(case when e.entry_type = 'DEBIT' then e.amount else -e.amount end), 0)::numeric(14,2) as balance,
  count(*)::bigint as movements_count,
  max(e.created_at) as last_movement_at,
  (array_agg(e.entry_type order by e.created_at desc, e.id desc))[1] as last_entry_type,
  (array_agg(e.origin_type order by e.created_at desc, e.id desc))[1] as last_origin_type,
  (array_agg(e.origin_id order by e.created_at desc, e.id desc))[1] as last_origin_id,
  (array_agg(e.amount order by e.created_at desc, e.id desc))[1] as last_amount
from public.customer_account_entries e
group by e.company_id, e.customer_id;
