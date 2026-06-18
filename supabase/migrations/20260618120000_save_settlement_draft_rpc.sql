create or replace function public.save_settlement_draft(
  p_settlement_id uuid,
  p_header jsonb,
  p_income_lines jsonb default '[]'::jsonb,
  p_expense_lines jsonb default '[]'::jsonb
)
returns public.settlements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_settlement public.settlements%rowtype;
  v_header jsonb := coalesce(p_header, '{}'::jsonb);
  v_income_lines jsonb := coalesce(p_income_lines, '[]'::jsonb);
  v_expense_lines jsonb := coalesce(p_expense_lines, '[]'::jsonb);
  v_prepared_by_name text := nullif(trim(coalesce(v_header->>'prepared_by_name', '')), '');
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para guardar una rendicion';
  end if;

  if jsonb_typeof(v_header) <> 'object' then
    raise exception 'La cabecera de la rendicion es invalida';
  end if;

  if jsonb_typeof(v_income_lines) <> 'array' then
    raise exception 'Los ingresos de la rendicion son invalidos';
  end if;

  if jsonb_typeof(v_expense_lines) <> 'array' then
    raise exception 'Los egresos de la rendicion son invalidos';
  end if;

  if nullif(v_header->>'settlement_date', '') is null then
    raise exception 'La fecha de rendicion es obligatoria';
  end if;

  if v_prepared_by_name is null then
    raise exception 'Debes indicar quien preparo la rendicion';
  end if;

  select *
  into v_settlement
  from public.settlements
  where id = p_settlement_id
  for update;

  if not found then
    raise exception 'Rendicion no encontrada';
  end if;

  if not public.can_operate_settlement_company(v_actor, v_settlement.company_id, 'settlements.edit') then
    raise exception 'No tienes permisos para editar rendiciones';
  end if;

  if v_settlement.status <> 'DRAFT' then
    raise exception 'Solo los borradores se pueden modificar';
  end if;

  update public.settlements
  set settlement_date = (v_header->>'settlement_date')::date,
      period_from = nullif(v_header->>'period_from', '')::date,
      period_to = nullif(v_header->>'period_to', '')::date,
      prepared_by_name = v_prepared_by_name,
      notes = nullif(trim(coalesce(v_header->>'notes', '')), ''),
      updated_at = now()
  where id = p_settlement_id
  returning * into v_settlement;

  delete from public.settlement_income_lines
  where settlement_id = p_settlement_id;

  insert into public.settlement_income_lines (
    company_id,
    settlement_id,
    line_date,
    work_order,
    receipt,
    quote,
    customer_name,
    concept,
    cash_amount,
    other_amount,
    income_type,
    display_order,
    created_by
  )
  select
    v_settlement.company_id,
    p_settlement_id,
    nullif(item.value->>'line_date', '')::date,
    nullif(trim(coalesce(item.value->>'work_order', '')), ''),
    nullif(trim(coalesce(item.value->>'receipt', '')), ''),
    nullif(trim(coalesce(item.value->>'quote', '')), ''),
    nullif(trim(coalesce(item.value->>'customer_name', '')), ''),
    trim(coalesce(item.value->>'concept', '')),
    coalesce(nullif(item.value->>'cash_amount', '')::numeric, 0),
    coalesce(nullif(item.value->>'other_amount', '')::numeric, 0),
    nullif(trim(coalesce(item.value->>'income_type', '')), ''),
    coalesce(nullif(item.value->>'display_order', '')::integer, item.ordinality::integer),
    v_actor
  from jsonb_array_elements(v_income_lines) with ordinality as item(value, ordinality);

  delete from public.settlement_expense_lines
  where settlement_id = p_settlement_id;

  insert into public.settlement_expense_lines (
    company_id,
    settlement_id,
    line_date,
    receipt,
    supplier_name,
    detail,
    purchase_order,
    cash_amount,
    other_amount,
    display_order,
    created_by
  )
  select
    v_settlement.company_id,
    p_settlement_id,
    nullif(item.value->>'line_date', '')::date,
    nullif(trim(coalesce(item.value->>'receipt', '')), ''),
    nullif(trim(coalesce(item.value->>'supplier_name', '')), ''),
    trim(coalesce(item.value->>'detail', '')),
    nullif(trim(coalesce(item.value->>'purchase_order', '')), ''),
    coalesce(nullif(item.value->>'cash_amount', '')::numeric, 0),
    coalesce(nullif(item.value->>'other_amount', '')::numeric, 0),
    coalesce(nullif(item.value->>'display_order', '')::integer, item.ordinality::integer),
    v_actor
  from jsonb_array_elements(v_expense_lines) with ordinality as item(value, ordinality);

  return v_settlement;
end;
$$;

revoke all on function public.save_settlement_draft(uuid, jsonb, jsonb, jsonb) from public;
grant execute on function public.save_settlement_draft(uuid, jsonb, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';
