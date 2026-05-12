alter table public.cash_expenses
  add column if not exists category text not null default 'OTROS',
  add column if not exists has_receipt boolean not null default false;

alter table public.cash_expenses
  drop constraint if exists cash_expenses_category_check,
  add constraint cash_expenses_category_check
    check (category in ('COMIDA', 'INSUMOS', 'ENVIO', 'LIMPIEZA', 'MOVILIDAD', 'OTROS'));

alter table public.cash_expenses
  drop constraint if exists cash_expenses_description_not_blank,
  add constraint cash_expenses_description_not_blank
    check (nullif(btrim(description), '') is not null);

create index if not exists cash_expenses_company_business_status_idx
  on public.cash_expenses(company_id, business_date desc, cancelled_at, category);

drop policy if exists "cash_expenses_insert_company_member" on public.cash_expenses;
create policy "cash_expenses_insert_company_member"
on public.cash_expenses
for insert
to authenticated
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and created_by = auth.uid()
  and (
    public.has_company_permission(auth.uid(), company_id, 'cash.create')
    or public.has_company_permission(auth.uid(), company_id, 'cash.edit')
  )
);

create or replace function public.cancel_cash_expense(
  p_expense_id uuid,
  p_reason text default null
)
returns public.cash_expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_expense public.cash_expenses%rowtype;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para anular gastos';
  end if;

  select *
  into v_expense
  from public.cash_expenses
  where id = p_expense_id
  for update;

  if not found then
    raise exception 'Gasto no encontrado';
  end if;

  if not public.has_company_permission(v_actor, v_expense.company_id, 'cash.cancel') then
    raise exception 'No tienes permisos para anular gastos';
  end if;

  if v_expense.cancelled_at is not null then
    return v_expense;
  end if;

  update public.cash_expenses
  set
    cancelled_at = now(),
    cancelled_by = v_actor,
    notes = case
      when nullif(btrim(coalesce(p_reason, '')), '') is null then notes
      when nullif(btrim(coalesce(notes, '')), '') is null then p_reason
      else notes || E'\n' || p_reason
    end
  where id = p_expense_id
  returning * into v_expense;

  return v_expense;
end;
$$;

grant execute on function public.cancel_cash_expense(uuid, text) to authenticated;
