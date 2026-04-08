alter type public.cash_payment_method add value if not exists 'EFECTIVO_REMITO';
alter type public.cash_payment_method add value if not exists 'EFECTIVO_FACTURABLE';
alter type public.cash_payment_method add value if not exists 'SERVICIOS_REMITO';

alter table public.cash_closures
  add column if not exists expected_cash_remito_total numeric(14,2) not null default 0,
  add column if not exists expected_cash_facturable_total numeric(14,2) not null default 0,
  add column if not exists expected_services_remito_total numeric(14,2) not null default 0;

create or replace function public.recalculate_cash_closure_totals(p_closure_id uuid)
returns public.cash_closures
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_closure public.cash_closures%rowtype;
  v_cash_remito_sales numeric(14,2);
  v_cash_facturable_sales numeric(14,2);
  v_services_remito_sales numeric(14,2);
  v_point_sales numeric(14,2);
  v_transfer_sales numeric(14,2);
  v_account_sales numeric(14,2);
  v_cash_expenses numeric(14,2);
  v_account_expenses numeric(14,2);
  v_cash_sales numeric(14,2);
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para recalcular caja';
  end if;

  select *
  into v_closure
  from public.cash_closures
  where id = p_closure_id
  for update;

  if not found then
    raise exception 'Cierre diario no encontrado';
  end if;

  if not public.has_company_permission(v_actor, v_closure.company_id, 'cash.view') then
    raise exception 'No tienes permisos para recalcular caja';
  end if;

  select
    coalesce(sum(case when payment_method in ('EFECTIVO', 'EFECTIVO_REMITO') and status <> 'ANULADA' then amount_total else 0 end), 0),
    coalesce(sum(case when payment_method = 'EFECTIVO_FACTURABLE' and status <> 'ANULADA' then amount_total else 0 end), 0),
    coalesce(sum(case when payment_method = 'SERVICIOS_REMITO' and status <> 'ANULADA' then amount_total else 0 end), 0),
    coalesce(sum(case when payment_method = 'POINT' and status <> 'ANULADA' then amount_total else 0 end), 0),
    coalesce(sum(case when payment_method = 'TRANSFERENCIA' and status <> 'ANULADA' then amount_total else 0 end), 0),
    coalesce(sum(case when payment_method = 'CUENTA_CORRIENTE' and status <> 'ANULADA' then amount_total else 0 end), 0)
  into
    v_cash_remito_sales,
    v_cash_facturable_sales,
    v_services_remito_sales,
    v_point_sales,
    v_transfer_sales,
    v_account_sales
  from public.cash_sales
  where company_id = v_closure.company_id
    and business_date = v_closure.business_date;

  v_cash_sales := v_cash_remito_sales + v_cash_facturable_sales;

  select
    coalesce(sum(case when expense_kind = 'CAJA' and cancelled_at is null then amount_total else 0 end), 0),
    coalesce(sum(case when expense_kind = 'CUENTA_CORRIENTE' and cancelled_at is null then amount_total else 0 end), 0)
  into v_cash_expenses, v_account_expenses
  from public.cash_expenses
  where company_id = v_closure.company_id
    and business_date = v_closure.business_date;

  update public.cash_closures
  set
    expected_cash_remito_total = v_cash_remito_sales,
    expected_cash_facturable_total = v_cash_facturable_sales,
    expected_services_remito_total = v_services_remito_sales,
    expected_cash_sales_total = v_cash_sales,
    expected_point_sales_total = v_point_sales,
    expected_transfer_sales_total = v_transfer_sales,
    expected_account_sales_total = v_account_sales,
    expected_cash_expenses_total = v_cash_expenses,
    expected_account_expenses_total = v_account_expenses,
    expected_sales_total = v_cash_sales + v_services_remito_sales + v_point_sales + v_transfer_sales + v_account_sales,
    expected_cash_to_render = v_cash_sales - v_cash_expenses,
    expected_non_cash_total = v_services_remito_sales + v_point_sales + v_transfer_sales + v_account_sales,
    cash_difference = case
      when counted_cash_total is null then null
      else counted_cash_total - (v_cash_sales - v_cash_expenses)
    end,
    point_difference = case
      when counted_point_total is null then null
      else counted_point_total - v_point_sales
    end,
    transfer_difference = case
      when counted_transfer_total is null then null
      else counted_transfer_total - v_transfer_sales
    end
  where id = v_closure.id
  returning * into v_closure;

  return v_closure;
end;
$$;
