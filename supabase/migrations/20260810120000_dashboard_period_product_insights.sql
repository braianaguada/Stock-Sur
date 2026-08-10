-- Company-scoped product profitability for an explicit dashboard period.
create or replace function public.get_dashboard_period_product_insights(
  p_company_id uuid,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if p_company_id is null or p_from is null or p_to is null or p_from > p_to then
    raise exception using errcode = '22023', message = 'Rango de dashboard invalido';
  end if;
  if (p_to - p_from) > 366 then
    raise exception using errcode = '22023', message = 'El rango maximo es de 366 dias';
  end if;
  if v_actor is null
    or not public.is_company_member(v_actor, p_company_id)
    or not public.has_company_permission(v_actor, p_company_id, 'cash.view') then
    raise exception using errcode = '42501', message = 'No tienes permisos para ver estas metricas';
  end if;

  with sold as (
    select
      dl.item_id,
      coalesce(i.name, dl.description, 'Producto') as name,
      coalesce(i.sku, dl.sku_snapshot) as sku,
      coalesce(nullif(dl.unit, ''), i.unit, 'un') as unit,
      sum((case when d.doc_type = 'REMITO_DEVOLUCION' then -1 else 1 end) * coalesce(dl.quantity, 0))::numeric as quantity,
      sum((case when d.doc_type = 'REMITO_DEVOLUCION' then -1 else 1 end) * coalesce(dl.line_total, dl.quantity * dl.unit_price, 0))::numeric as revenue,
      sum((case when d.doc_type = 'REMITO_DEVOLUCION' then -1 else 1 end) * coalesce(dl.quantity, 0) * coalesce(dl.base_cost_snapshot, 0))::numeric as cost
    from public.documents d
    join public.document_lines dl on dl.document_id = d.id
    left join public.items i on i.id = dl.item_id and i.company_id = d.company_id
    where d.company_id = p_company_id
      and d.issue_date between p_from and p_to
      and d.status = 'EMITIDO'
      and d.doc_type in ('REMITO', 'REMITO_DEVOLUCION')
      and coalesce(d.customer_kind, 'GENERAL') <> 'INTERNO'
    group by dl.item_id, coalesce(i.name, dl.description, 'Producto'), coalesce(i.sku, dl.sku_snapshot), coalesce(nullif(dl.unit, ''), i.unit, 'un')
  )
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'quantity', coalesce(sum(quantity), 0),
      'revenue', coalesce(sum(revenue), 0),
      'cost', coalesce(sum(cost), 0),
      'grossProfit', coalesce(sum(revenue - cost), 0)
    ),
    'topItems', coalesce((
      select jsonb_agg(jsonb_build_object(
        'itemId', item_id, 'name', name, 'sku', sku, 'unit', unit,
        'quantity', quantity, 'revenue', revenue, 'cost', cost,
        'grossProfit', revenue - cost
      ) order by revenue desc)
      from (select * from sold order by revenue desc limit 10) ranked
    ), '[]'::jsonb)
  ) into v_result
  from sold;

  return coalesce(v_result, jsonb_build_object('totals', jsonb_build_object('quantity', 0, 'revenue', 0, 'cost', 0, 'grossProfit', 0), 'topItems', '[]'::jsonb));
end;
$$;

revoke all on function public.get_dashboard_period_product_insights(uuid, date, date) from public;
grant execute on function public.get_dashboard_period_product_insights(uuid, date, date) to authenticated;
notify pgrst, 'reload schema';
