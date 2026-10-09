create index if not exists stock_movements_company_item_created_idx
  on public.stock_movements (company_id, item_id, created_at desc);

create or replace function public.get_stock_summary(p_company_id uuid)
returns table (
  item_id uuid, item_name text, item_sku text, item_unit text, item_supplier text,
  item_brand text, item_model text, item_attributes text, item_category text,
  demand_profile text, demand_monthly_estimate numeric, total numeric,
  out_30d numeric, out_90d numeric, out_365d numeric,
  out_month_buckets_12m numeric[]
)
language sql stable security invoker set search_path = public
as $$
  with base as (
    select i.id, i.name, i.sku, i.unit, i.supplier, i.brand, i.model, i.attributes,
      i.category, i.demand_profile, i.demand_monthly_estimate
    from public.items i
    where i.company_id = p_company_id and i.is_active = true
  ), agg as (
    select sm.item_id,
      coalesce(sum(case when sm.type = 'OUT' then -sm.quantity else sm.quantity end), 0) as total,
      coalesce(sum(case when sm.type = 'OUT' and sm.created_at >= now() - interval '30 days' then sm.quantity else 0 end), 0) as out_30d,
      coalesce(sum(case when sm.type = 'OUT' and sm.created_at >= now() - interval '90 days' then sm.quantity else 0 end), 0) as out_90d,
      coalesce(sum(case when sm.type = 'OUT' and sm.created_at >= now() - interval '365 days' then sm.quantity else 0 end), 0) as out_365d,
      array[
        coalesce(sum(case when sm.type = 'OUT' and sm.created_at >= date_trunc('month', now()) - interval '0 months' and sm.created_at < date_trunc('month', now()) + interval '1 month' then sm.quantity else 0 end), 0),
        coalesce(sum(case when sm.type = 'OUT' and sm.created_at >= date_trunc('month', now()) - interval '1 months' and sm.created_at < date_trunc('month', now()) then sm.quantity else 0 end), 0),
        coalesce(sum(case when sm.type = 'OUT' and sm.created_at >= date_trunc('month', now()) - interval '2 months' and sm.created_at < date_trunc('month', now()) - interval '1 months' then sm.quantity else 0 end), 0),
        coalesce(sum(case when sm.type = 'OUT' and sm.created_at >= date_trunc('month', now()) - interval '3 months' and sm.created_at < date_trunc('month', now()) - interval '2 months' then sm.quantity else 0 end), 0),
        coalesce(sum(case when sm.type = 'OUT' and sm.created_at >= date_trunc('month', now()) - interval '4 months' and sm.created_at < date_trunc('month', now()) - interval '3 months' then sm.quantity else 0 end), 0),
        coalesce(sum(case when sm.type = 'OUT' and sm.created_at >= date_trunc('month', now()) - interval '5 months' and sm.created_at < date_trunc('month', now()) - interval '4 months' then sm.quantity else 0 end), 0),
        coalesce(sum(case when sm.type = 'OUT' and sm.created_at >= date_trunc('month', now()) - interval '6 months' and sm.created_at < date_trunc('month', now()) - interval '5 months' then sm.quantity else 0 end), 0),
        coalesce(sum(case when sm.type = 'OUT' and sm.created_at >= date_trunc('month', now()) - interval '7 months' and sm.created_at < date_trunc('month', now()) - interval '6 months' then sm.quantity else 0 end), 0),
        coalesce(sum(case when sm.type = 'OUT' and sm.created_at >= date_trunc('month', now()) - interval '8 months' and sm.created_at < date_trunc('month', now()) - interval '7 months' then sm.quantity else 0 end), 0),
        coalesce(sum(case when sm.type = 'OUT' and sm.created_at >= date_trunc('month', now()) - interval '9 months' and sm.created_at < date_trunc('month', now()) - interval '8 months' then sm.quantity else 0 end), 0),
        coalesce(sum(case when sm.type = 'OUT' and sm.created_at >= date_trunc('month', now()) - interval '10 months' and sm.created_at < date_trunc('month', now()) - interval '9 months' then sm.quantity else 0 end), 0),
        coalesce(sum(case when sm.type = 'OUT' and sm.created_at >= date_trunc('month', now()) - interval '11 months' and sm.created_at < date_trunc('month', now()) - interval '10 months' then sm.quantity else 0 end), 0)
      ]::numeric[] as out_month_buckets_12m
    from public.stock_movements sm
    where sm.company_id = p_company_id
    group by sm.item_id
  )
  select b.id, b.name, b.sku, b.unit, b.supplier, b.brand, b.model, b.attributes, b.category,
    b.demand_profile, b.demand_monthly_estimate,
    coalesce(a.total, 0), coalesce(a.out_30d, 0), coalesce(a.out_90d, 0), coalesce(a.out_365d, 0),
    coalesce(a.out_month_buckets_12m, array_fill(0::numeric, array[12]))
  from base b left join agg a on a.item_id = b.id
  order by b.name;
$$;

grant execute on function public.get_stock_summary(uuid) to authenticated;
