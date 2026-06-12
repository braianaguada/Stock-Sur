create index if not exists stock_movements_company_item_idx
  on public.stock_movements(company_id, item_id);

create or replace function public.get_dashboard_operational_overview(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
  v_can_cash boolean;
  v_can_customers boolean;
  v_can_documents boolean;
  v_can_billing boolean;
begin
  if v_actor is null or not public.is_company_member(v_actor, p_company_id) then
    raise exception 'No tienes acceso a la empresa indicada';
  end if;

  v_can_cash := public.has_company_permission(v_actor, p_company_id, 'cash.view');
  v_can_customers := public.has_company_permission(v_actor, p_company_id, 'customers.view');
  v_can_documents := public.has_company_permission(v_actor, p_company_id, 'documents.view');
  v_can_billing := public.has_company_permission(v_actor, p_company_id, 'billing.view');

  with
  active_items as (
    select id, name, sku, attributes, category
    from public.items
    where company_id = p_company_id
      and is_active = true
  ),
  stock_levels as (
    select
      sm.item_id,
      sum(case when sm.type = 'OUT' then -sm.quantity else sm.quantity end)::numeric as quantity
    from public.stock_movements sm
    where sm.company_id = p_company_id
    group by sm.item_id
  ),
  inventory as (
    select
      i.id,
      i.name,
      i.sku,
      i.attributes,
      coalesce(nullif(btrim(i.category), ''), 'Sin categoria') as category,
      greatest(coalesce(s.quantity, 0), 0)::numeric as quantity,
      greatest(coalesce(p.base_cost, 0), 0)::numeric as base_cost,
      greatest(coalesce(s.quantity, 0), 0)::numeric * greatest(coalesce(p.base_cost, 0), 0)::numeric as stock_value
    from active_items i
    left join stock_levels s on s.item_id = i.id
    left join public.item_pricing_base p
      on p.company_id = p_company_id
     and p.item_id = i.id
  ),
  inventory_metrics as (
    select
      coalesce(sum(stock_value), 0)::numeric as inventory_value,
      coalesce(sum(quantity), 0)::numeric as inventory_units,
      count(*) filter (where quantity > 0)::integer as items_with_stock,
      count(*)::integer as active_items,
      count(*) filter (where quantity > 0 and base_cost <= 0)::integer as items_without_cost,
      count(*) filter (where quantity > 0 and base_cost > 0)::integer as valued_items
    from inventory
  ),
  top_items as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'itemId', ranked.id,
      'name', trim(concat(ranked.name, case when nullif(btrim(ranked.attributes), '') is not null then ' - ' || ranked.attributes else '' end)),
      'sku', ranked.sku,
      'quantity', ranked.quantity,
      'baseCost', ranked.base_cost,
      'stockValue', ranked.stock_value
    ) order by ranked.stock_value desc), '[]'::jsonb) as value
    from (
      select *
      from inventory
      where stock_value > 0
      order by stock_value desc
      limit 5
    ) ranked
  ),
  category_values as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'category', ranked.category,
      'value', ranked.value
    ) order by ranked.value desc), '[]'::jsonb) as value
    from (
      select category, sum(stock_value)::numeric as value
      from inventory
      where stock_value > 0
      group by category
      order by value desc
      limit 5
    ) ranked
  ),
  month_buckets as (
    select generate_series(
      date_trunc('month', current_date) - interval '5 months',
      date_trunc('month', current_date),
      interval '1 month'
    )::date as month_start
  ),
  monthly_sales as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'month', to_char(b.month_start, 'YYYY-MM'),
      'total', coalesce(s.total, 0),
      'count', coalesce(s.count, 0)
    ) order by b.month_start), '[]'::jsonb) as value
    from month_buckets b
    left join (
      select
        date_trunc('month', business_date)::date as month_start,
        sum(amount_total)::numeric as total,
        count(*)::integer as count
      from public.cash_sales
      where company_id = p_company_id
        and v_can_cash
        and status <> 'ANULADA'
        and business_date >= date_trunc('month', current_date) - interval '5 months'
      group by date_trunc('month', business_date)::date
    ) s on s.month_start = b.month_start
  ),
  operations as (
    select
      coalesce((select sum(amount_total) from public.cash_sales where v_can_cash and company_id = p_company_id and status <> 'ANULADA' and business_date = current_date), 0)::numeric as sales_today,
      coalesce((select count(*) from public.cash_sales where v_can_cash and company_id = p_company_id and status <> 'ANULADA' and business_date = current_date), 0)::integer as sales_today_count,
      coalesce((select sum(amount_total) from public.cash_sales where v_can_cash and company_id = p_company_id and status <> 'ANULADA' and business_date >= date_trunc('month', current_date)::date), 0)::numeric as sales_month,
      coalesce((
        select sum(greatest(customer_balance, 0))
        from (
          select sum(case when entry_type = 'DEBIT' then amount else -amount end)::numeric as customer_balance
          from public.customer_account_entries
          where v_can_customers
            and company_id = p_company_id
          group by customer_id
        ) customer_balances
      ), 0)::numeric as accounts_receivable,
      coalesce((select count(*) from public.cash_sales where v_can_cash and company_id = p_company_id and status <> 'ANULADA' and receipt_kind = 'PENDIENTE'), 0)::integer as pending_receipts,
      coalesce((select count(*) from public.documents where v_can_documents and company_id = p_company_id and status = 'BORRADOR'), 0)::integer as draft_documents,
      coalesce((select count(*) from public.service_jobs where v_can_customers and company_id = p_company_id and status in ('OPEN', 'IN_PROGRESS', 'ON_HOLD')), 0)::integer as open_jobs,
      coalesce((select count(*) from public.service_jobs where v_can_customers and company_id = p_company_id and status in ('OPEN', 'IN_PROGRESS', 'ON_HOLD') and priority in ('HIGH', 'URGENT')), 0)::integer as priority_jobs,
      coalesce((select count(*) from public.service_documents where v_can_documents and company_id = p_company_id and status = 'SENT'), 0)::integer as sent_service_quotes,
      coalesce((select count(*) from public.billing_documents where v_can_billing and company_id = p_company_id and fiscal_status in ('DRAFT', 'READY_TO_AUTHORIZE', 'REJECTED')), 0)::integer as pending_billing
  )
  select jsonb_build_object(
    'metrics', jsonb_build_object(
      'inventoryValue', m.inventory_value,
      'inventoryUnits', m.inventory_units,
      'itemsWithStock', m.items_with_stock,
      'activeItems', m.active_items,
      'itemsWithoutCost', m.items_without_cost,
      'valuedItemsShare', case when m.items_with_stock > 0 then round((m.valued_items::numeric / m.items_with_stock) * 100) else 0 end,
      'salesToday', o.sales_today,
      'salesTodayCount', o.sales_today_count,
      'salesMonth', o.sales_month,
      'accountsReceivable', o.accounts_receivable
    ),
    'actions', jsonb_build_array(
      jsonb_build_object('key', 'missing-cost', 'label', 'Stock sin costo base', 'count', m.items_without_cost, 'detail', 'No entra en la valorizacion del capital.', 'href', '/price-lists?tab=base', 'tone', 'warning'),
      jsonb_build_object('key', 'pending-receipts', 'label', 'Ventas sin comprobante', 'count', o.pending_receipts, 'detail', 'Ventas de caja que aun requieren comprobante.', 'href', '/cash', 'tone', 'warning'),
      jsonb_build_object('key', 'open-jobs', 'label', 'Trabajos abiertos', 'count', o.open_jobs, 'detail', concat(o.priority_jobs, ' con prioridad alta o urgente.'), 'href', '/service-jobs', 'tone', case when o.priority_jobs > 0 then 'danger' else 'info' end),
      jsonb_build_object('key', 'sent-quotes', 'label', 'Presupuestos de servicio enviados', 'count', o.sent_service_quotes, 'detail', 'Esperan aprobacion o rechazo del cliente.', 'href', '/services/documents', 'tone', 'info'),
      jsonb_build_object('key', 'pending-billing', 'label', 'Facturacion pendiente', 'count', o.pending_billing, 'detail', 'Borradores, comprobantes por autorizar o rechazados.', 'href', '/billing', 'tone', 'warning'),
      jsonb_build_object('key', 'draft-documents', 'label', 'Documentos en borrador', 'count', o.draft_documents, 'detail', 'Documentos comerciales que todavia no se emitieron.', 'href', '/documents', 'tone', 'default')
    ),
    'monthlySales', ms.value,
    'topItemsByValue', ti.value,
    'categoryValues', cv.value
  )
  into v_result
  from inventory_metrics m
  cross join operations o
  cross join monthly_sales ms
  cross join top_items ti
  cross join category_values cv;

  return v_result;
end;
$$;

revoke all on function public.get_dashboard_operational_overview(uuid) from public;
grant execute on function public.get_dashboard_operational_overview(uuid) to authenticated;

notify pgrst, 'reload schema';
