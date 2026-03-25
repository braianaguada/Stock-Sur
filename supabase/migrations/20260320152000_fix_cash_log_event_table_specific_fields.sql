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
  v_company_id uuid;
begin
  v_entity_type := case tg_table_name
    when 'cash_sales' then 'VENTA'::public.cash_event_entity_type
    when 'cash_expenses' then 'GASTO'::public.cash_event_entity_type
    else 'CIERRE'::public.cash_event_entity_type
  end;

  v_company_id := coalesce(new.company_id, old.company_id);

  if tg_op = 'INSERT' then
    v_entity_id := new.id;
    if tg_table_name = 'cash_sales' then
      v_event_type := 'VENTA_CREADA';
    elsif tg_table_name = 'cash_expenses' then
      v_event_type := 'GASTO_CREADO';
    else
      v_event_type := 'CIERRE_CREADO';
    end if;
    v_payload := jsonb_build_object('current', to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    v_entity_id := new.id;
    if tg_table_name = 'cash_sales' then
      v_event_type := case
        when old.status::text <> 'ANULADA' and new.status::text = 'ANULADA' then 'VENTA_ANULADA'
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
    if tg_table_name = 'cash_sales' then
      v_event_type := 'VENTA_ELIMINADA';
    elsif tg_table_name = 'cash_expenses' then
      v_event_type := 'GASTO_ELIMINADO';
    else
      v_event_type := 'CIERRE_ELIMINADO';
    end if;
    v_payload := jsonb_build_object('previous', to_jsonb(old));
  end if;

  insert into public.cash_events (company_id, entity_type, entity_id, event_type, payload, created_by)
  values (v_company_id, v_entity_type, v_entity_id, v_event_type, v_payload, auth.uid());

  return coalesce(new, old);
end;
$$;
