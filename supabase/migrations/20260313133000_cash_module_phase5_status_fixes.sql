alter table public.cash_sales
  drop constraint if exists cash_sales_pending_kind_consistency_check;

alter table public.cash_sales
  add constraint cash_sales_pending_kind_consistency_check check (
    status = 'ANULADA'
    or (receipt_kind = 'PENDIENTE' and status in ('REGISTRADA', 'PENDIENTE_COMPROBANTE'))
    or (receipt_kind <> 'PENDIENTE')
  );

create or replace function public.log_cash_event()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_entity_type public.cash_event_entity_type;
  v_entity_id uuid;
  v_event_type text;
  v_payload jsonb;
begin
  v_entity_type := case tg_table_name
    when 'cash_sales' then 'VENTA'::public.cash_event_entity_type
    when 'cash_expenses' then 'GASTO'::public.cash_event_entity_type
    else 'CIERRE'::public.cash_event_entity_type
  end;

  if tg_op = 'INSERT' then
    v_entity_id := new.id;
    v_event_type := case tg_table_name
      when 'cash_sales' then 'VENTA_CREADA'
      when 'cash_expenses' then 'GASTO_CREADO'
      else 'CIERRE_CREADO'
    end;
    v_payload := jsonb_build_object('current', to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    v_entity_id := new.id;

    if tg_table_name = 'cash_sales' then
      v_event_type := case
        when old.status <> 'ANULADA' and new.status = 'ANULADA' then 'VENTA_ANULADA'
        else 'VENTA_ACTUALIZADA'
      end;
    elsif tg_table_name = 'cash_expenses' then
      v_event_type := case
        when old.cancelled_at is null and new.cancelled_at is not null then 'GASTO_ANULADO'
        else 'GASTO_ACTUALIZADO'
      end;
    else
      v_event_type := case
        when old.status <> 'CERRADO' and new.status = 'CERRADO' then 'CIERRE_CERRADO'
        else 'CIERRE_ACTUALIZADO'
      end;
    end if;

    v_payload := jsonb_build_object(
      'previous', to_jsonb(old),
      'current', to_jsonb(new)
    );
  else
    v_entity_id := old.id;
    v_event_type := case tg_table_name
      when 'cash_sales' then 'VENTA_ELIMINADA'
      when 'cash_expenses' then 'GASTO_ELIMINADO'
      else 'CIERRE_ELIMINADO'
    end;
    v_payload := jsonb_build_object('previous', to_jsonb(old));
  end if;

  insert into public.cash_events (entity_type, entity_id, event_type, payload, created_by)
  values (v_entity_type, v_entity_id, v_event_type, v_payload, auth.uid());

  return coalesce(new, old);
end;
$$;
