create or replace function public.prevent_changes_on_closed_cash_closure()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status public.cash_closure_status;
begin
  if tg_table_name = 'cash_closures' then
    if tg_op = 'UPDATE' and old.status = 'CERRADO' then
      raise exception 'El cierre diario ya esta cerrado y no admite modificaciones';
    end if;

    if tg_op = 'DELETE' and old.status = 'CERRADO' then
      raise exception 'No se puede eliminar un cierre diario cerrado';
    end if;

    return coalesce(new, old);
  end if;

  if old.closure_id is null then
    return coalesce(new, old);
  end if;

  select status
  into v_status
  from public.cash_closures
  where id = old.closure_id;

  if v_status <> 'CERRADO' then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'cash_sales' and tg_op = 'UPDATE' then
    if old.receipt_kind = 'PENDIENTE'
       and new.receipt_kind <> 'PENDIENTE'
       and new.amount_total = old.amount_total
       and new.payment_method = old.payment_method
       and new.business_date = old.business_date
       and new.sold_at = old.sold_at
       and coalesce(new.closure_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(old.closure_id, '00000000-0000-0000-0000-000000000000'::uuid)
       and new.status <> 'ANULADA'
    then
      return new;
    end if;
  end if;

  raise exception 'No se puede modificar un movimiento incluido en un cierre cerrado';
end;
$$;
