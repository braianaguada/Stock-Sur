create or replace function public.get_dashboard_business_insights(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_can_cash boolean;
  v_result jsonb;
begin
  if v_actor is null or not public.is_company_member(v_actor, p_company_id) then
    raise exception 'No tienes acceso a la empresa indicada';
  end if;

  v_can_cash := public.has_company_permission(v_actor, p_company_id, 'cash.view');

  with
  month_buckets as (
    select generate_series(
      date_trunc('month', current_date) - interval '5 months',
      date_trunc('month', current_date),
      interval '1 month'
    )::date as month_start
  ),
  monthly_sales as (
    select
      date_trunc('month', business_date)::date as month_start,
      sum(amount_total)::numeric as total,
      count(*)::integer as count
    from public.cash_sales
    where v_can_cash
      and company_id = p_company_id
      and status <> 'ANULADA'
      and business_date >= date_trunc('month', current_date) - interval '5 months'
    group by date_trunc('month', business_date)::date
  ),
  monthly_expenses as (
    select
      date_trunc('month', business_date)::date as month_start,
      sum(amount_total)::numeric as total
    from public.cash_expenses
    where v_can_cash
      and company_id = p_company_id
      and cancelled_at is null
      and business_date >= date_trunc('month', current_date) - interval '5 months'
    group by date_trunc('month', business_date)::date
  ),
  monthly_cash as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'month', to_char(b.month_start, 'YYYY-MM'),
      'sales', coalesce(s.total, 0),
      'expenses', coalesce(e.total, 0),
      'net', coalesce(s.total, 0) - coalesce(e.total, 0),
      'count', coalesce(s.count, 0)
    ) order by b.month_start), '[]'::jsonb) as value
    from month_buckets b
    left join monthly_sales s on s.month_start = b.month_start
    left join monthly_expenses e on e.month_start = b.month_start
  ),
  document_profit_lines as (
    select
      d.id as document_id,
      date_trunc('month', d.issue_date)::date as month_start,
      case when d.doc_type = 'REMITO_DEVOLUCION' then -1 else 1 end::numeric as sign,
      coalesce(dl.line_total, dl.quantity * dl.unit_price, 0)::numeric as gross_line,
      greatest(coalesce(dl.tax_pct, 0), 0)::numeric as tax_pct,
      greatest(coalesce(dl.base_cost_snapshot, 0), 0)::numeric * greatest(coalesce(dl.quantity, 0), 0)::numeric as product_cost
    from public.documents d
    join public.document_lines dl on dl.document_id = d.id
    where v_can_cash
      and d.company_id = p_company_id
      and d.status = 'EMITIDO'
      and d.doc_type in ('REMITO', 'REMITO_DEVOLUCION')
      and coalesce(d.customer_kind, 'GENERAL') <> 'INTERNO'
      and d.issue_date >= date_trunc('month', current_date) - interval '5 months'
  ),
  monthly_profit_source as (
    select
      month_start,
      sum(sign * gross_line)::numeric as gross_revenue,
      sum(sign * case when tax_pct > 0 then gross_line / (1 + tax_pct / 100) else gross_line end)::numeric as net_revenue,
      sum(sign * case when tax_pct > 0 then gross_line - (gross_line / (1 + tax_pct / 100)) else 0 end)::numeric as tax_total,
      sum(sign * product_cost)::numeric as product_cost,
      sum(sign * ((case when tax_pct > 0 then gross_line / (1 + tax_pct / 100) else gross_line end) - product_cost))::numeric as gross_profit,
      count(distinct document_id)::integer as count
    from document_profit_lines
    group by month_start
  ),
  monthly_profit as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'month', to_char(b.month_start, 'YYYY-MM'),
      'grossRevenue', coalesce(p.gross_revenue, 0),
      'netRevenue', coalesce(p.net_revenue, 0),
      'tax', coalesce(p.tax_total, 0),
      'productCost', coalesce(p.product_cost, 0),
      'grossProfit', coalesce(p.gross_profit, 0),
      'profitMarginPct', case when coalesce(p.net_revenue, 0) <> 0 then round((coalesce(p.gross_profit, 0) / nullif(p.net_revenue, 0)) * 100, 1) else 0 end,
      'count', coalesce(p.count, 0)
    ) order by b.month_start), '[]'::jsonb) as value
    from month_buckets b
    left join monthly_profit_source p on p.month_start = b.month_start
  ),
  current_profit as (
    select
      coalesce(sum(gross_revenue), 0)::numeric as gross_revenue,
      coalesce(sum(net_revenue), 0)::numeric as net_revenue,
      coalesce(sum(tax_total), 0)::numeric as tax_total,
      coalesce(sum(product_cost), 0)::numeric as product_cost,
      coalesce(sum(gross_profit), 0)::numeric as gross_profit
    from monthly_profit_source
    where month_start = date_trunc('month', current_date)::date
  ),
  payment_methods as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'method', ranked.payment_method,
      'total', ranked.total,
      'count', ranked.count
    ) order by ranked.total desc), '[]'::jsonb) as value
    from (
      select payment_method::text, sum(amount_total)::numeric as total, count(*)::integer as count
      from public.cash_sales
      where v_can_cash
        and company_id = p_company_id
        and status <> 'ANULADA'
        and business_date >= date_trunc('month', current_date)::date
      group by payment_method
      order by total desc
    ) ranked
  ),
  stock_levels as (
    select
      item_id,
      sum(case when type = 'OUT' then -quantity else quantity end)::numeric as quantity,
      max(created_at) filter (where type = 'OUT') as last_out_at,
      coalesce(sum(quantity) filter (where type = 'OUT' and created_at >= current_date - interval '30 days'), 0)::numeric as out_30
    from public.stock_movements
    where company_id = p_company_id
    group by item_id
  ),
  inventory_activity as (
    select
      i.id,
      trim(concat(i.name, case when nullif(btrim(i.attributes), '') is not null then ' - ' || i.attributes else '' end)) as name,
      greatest(coalesce(s.quantity, 0), 0)::numeric as quantity,
      greatest(coalesce(p.base_cost, 0), 0)::numeric as base_cost,
      greatest(coalesce(s.quantity, 0), 0)::numeric * greatest(coalesce(p.base_cost, 0), 0)::numeric as stock_value,
      s.last_out_at,
      coalesce(s.out_30, 0)::numeric as out_30
    from public.items i
    left join stock_levels s on s.item_id = i.id
    left join public.item_pricing_base p
      on p.company_id = p_company_id
     and p.item_id = i.id
    where i.company_id = p_company_id
      and i.is_active = true
  ),
  stock_metrics as (
    select
      coalesce(sum(stock_value) filter (where quantity > 0 and (last_out_at is null or last_out_at < current_date - interval '90 days')), 0)::numeric as slow_stock_value,
      count(*) filter (where quantity > 0 and (last_out_at is null or last_out_at < current_date - interval '90 days'))::integer as slow_stock_items
    from inventory_activity
  ),
  slow_stock as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'itemId', ranked.id,
      'name', ranked.name,
      'quantity', ranked.quantity,
      'stockValue', ranked.stock_value,
      'lastOutAt', ranked.last_out_at
    ) order by ranked.stock_value desc), '[]'::jsonb) as value
    from (
      select *
      from inventory_activity
      where quantity > 0
        and stock_value > 0
        and (last_out_at is null or last_out_at < current_date - interval '90 days')
      order by stock_value desc
      limit 5
    ) ranked
  ),
  stock_velocity as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'itemId', ranked.id,
      'name', ranked.name,
      'out30', ranked.out_30,
      'currentStock', ranked.quantity
    ) order by ranked.out_30 desc), '[]'::jsonb) as value
    from (
      select *
      from inventory_activity
      where out_30 > 0
      order by out_30 desc
      limit 5
    ) ranked
  ),
  current_metrics as (
    select
      coalesce((select sum(amount_total) from public.cash_sales where v_can_cash and company_id = p_company_id and status <> 'ANULADA' and business_date >= date_trunc('month', current_date)::date), 0)::numeric as sales_month,
      coalesce((select count(*) from public.cash_sales where v_can_cash and company_id = p_company_id and status <> 'ANULADA' and business_date >= date_trunc('month', current_date)::date), 0)::integer as sales_count,
      coalesce((select sum(amount_total) from public.cash_expenses where v_can_cash and company_id = p_company_id and cancelled_at is null and business_date >= date_trunc('month', current_date)::date), 0)::numeric as expenses_month,
      coalesce((
        select sum(amount_total)
        from public.cash_sales
        where v_can_cash
          and company_id = p_company_id
          and status <> 'ANULADA'
          and business_date >= date_trunc('month', current_date) - interval '1 month'
          and business_date < date_trunc('month', current_date) - interval '1 month'
            + ((current_date - date_trunc('month', current_date)::date) + 1) * interval '1 day'
      ), 0)::numeric as previous_sales_month
  )
  select jsonb_build_object(
    'metrics', jsonb_build_object(
      'expensesMonth', c.expenses_month,
      'cashNetMonth', c.sales_month - c.expenses_month,
      'averageTicket', case when c.sales_count > 0 then round(c.sales_month / c.sales_count, 2) else 0 end,
      'salesGrowthPct', case when c.previous_sales_month > 0 then round(((c.sales_month - c.previous_sales_month) / c.previous_sales_month) * 100, 1) else 0 end,
      'slowStockValue', s.slow_stock_value,
      'slowStockItems', s.slow_stock_items,
      'salesNetMonth', cp.net_revenue,
      'taxMonth', cp.tax_total,
      'productCostMonth', cp.product_cost,
      'grossProfitMonth', cp.gross_profit,
      'profitMarginPct', case when cp.net_revenue <> 0 then round((cp.gross_profit / nullif(cp.net_revenue, 0)) * 100, 1) else 0 end
    ),
    'monthlyCash', mc.value,
    'monthlyProfit', mp.value,
    'paymentMethods', pm.value,
    'slowStock', ss.value,
    'stockVelocity', sv.value
  )
  into v_result
  from current_metrics c
  cross join current_profit cp
  cross join stock_metrics s
  cross join monthly_cash mc
  cross join monthly_profit mp
  cross join payment_methods pm
  cross join slow_stock ss
  cross join stock_velocity sv;

  return v_result;
end;
$$;

revoke all on function public.get_dashboard_business_insights(uuid) from public;
grant execute on function public.get_dashboard_business_insights(uuid) to authenticated;

drop policy if exists "profiles_select_superadmin" on public.profiles;

create policy "profiles_select_superadmin"
on public.profiles
for select
to authenticated
using (public.is_superadmin(auth.uid()));

notify pgrst, 'reload schema';
