begin;

create index if not exists items_company_active_name_page_idx
  on public.items(company_id, is_active, name, id);
create index if not exists item_aliases_company_item_idx
  on public.item_aliases(company_id, item_id);

-- Shared sign convention for stock summaries and catalog filters.
create function public.stock_quantity_delta(p_type text, p_quantity numeric)
returns numeric language sql immutable parallel safe set search_path = public, pg_temp
as $$ select case when p_type = 'OUT' then -p_quantity else p_quantity end $$;

-- Keep natural item search compatible with the catalog and document picker.
create function public.normalize_catalog_search(p_text text)
returns text language plpgsql immutable parallel safe set search_path = public, pg_temp
as $$
declare v text := public.normalize_document_search(p_text);
begin
  v := regexp_replace(v, '\m(media pulgada|una mitad|media|medio)\M', '1/2', 'g');
  v := regexp_replace(v, '\mtres cuartos\M', '3/4', 'g');
  v := regexp_replace(v, '\m(un cuarto|cuarto)\M', '1/4', 'g');
  v := regexp_replace(v, '\moctavo\M', '1/8', 'g');
  v := regexp_replace(v, '\maa\M', 'aire acondicionado', 'g');
  v := regexp_replace(v, '\msplit\M', 'aire acondicionado split', 'g');
  return v;
end $$;
create function public.catalog_search_matches(p_query text, p_candidate text)
returns boolean language sql immutable parallel safe set search_path = public, pg_temp
as $$
  select not exists (
    select 1 from regexp_split_to_table(public.normalize_catalog_search(p_query), ' +') t(token)
    where token <> '' and strpos(public.normalize_catalog_search(p_candidate), token) = 0
      and not (token = 'cano' and strpos(public.normalize_catalog_search(p_candidate), 'tubo') > 0)
      and not (token = 'canos' and strpos(public.normalize_catalog_search(p_candidate), 'tubos') > 0)
  )
$$;

create function public.list_items_page(
  p_company_id uuid, p_search text default '', p_status text default 'active',
  p_category text default 'all', p_supplier text default 'all', p_stock text default 'all',
  p_sort text default 'name', p_direction text default 'asc',
  p_page integer default 1, p_page_size integer default 10
)
returns jsonb language plpgsql stable security invoker set search_path = public, pg_temp
as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not public.is_company_member(auth.uid(), p_company_id)
    or not exists(select 1 from public.companies where id = p_company_id and status = 'ACTIVE') then
    raise exception 'Sin acceso al catálogo de esta empresa' using errcode = '42501';
  end if;
  if p_page is null or p_page < 1 or p_page_size is null or p_page_size not between 1 and 200
    or p_status not in ('active','inactive','all') or p_stock not in ('all','in_stock','no_stock')
    or p_sort not in ('sku','name','supplier','brand','model','attributes','category','is_active','created_at','stock')
    or p_direction not in ('asc','desc') then
    raise exception 'Página o filtros de ítems inválidos' using errcode = '22023';
  end if;
  with stock as materialized (
    select sm.item_id, sum(public.stock_quantity_delta(sm.type::text, sm.quantity)) as stock
    from public.stock_movements sm where sm.company_id = p_company_id group by sm.item_id
  ), catalog as materialized (
    select i.id,i.sku,i.name,i.supplier,i.brand,i.model,i.attributes,i.unit,i.category,
      i.demand_profile,i.demand_monthly_estimate,i.is_active,i.created_at,coalesce(s.stock,0) as stock
    from public.items i left join stock s on s.item_id = i.id where i.company_id = p_company_id
  ), filtered as materialized (
    select c.* from catalog c
    where (p_status = 'all' or c.is_active = (p_status = 'active'))
      and (p_category = 'all' or c.category = p_category)
      and (p_supplier = 'all' or c.supplier = p_supplier)
      and (p_stock = 'all' or (p_stock = 'in_stock' and c.stock > 0) or (p_stock = 'no_stock' and c.stock <= 0))
      and public.catalog_search_matches(p_search, concat_ws(' ',c.sku,c.name,c.supplier,
        c.brand,c.model,c.attributes,c.category,c.unit,
        (select string_agg(a.alias,' ') from public.item_aliases a
          where a.company_id = p_company_id and a.item_id = c.id)))
  ), paging as (
    select count(*) as total, least(p_page::bigint,greatest(1::bigint,(count(*) + p_page_size - 1)/p_page_size)) as page
    from filtered
  ), visible as materialized (
    select f.* from filtered f
    order by
      case when p_sort = 'stock' and p_direction = 'asc' then stock end asc nulls last,
      case when p_sort = 'stock' and p_direction = 'desc' then stock end desc nulls last,
      case when p_direction = 'asc' and p_sort <> 'stock' then
        case p_sort when 'is_active' then is_active::text when 'created_at' then created_at::text
        else public.normalize_document_search(to_jsonb(f)->>p_sort) end end asc nulls last,
      case when p_direction = 'desc' and p_sort <> 'stock' then
        case p_sort when 'is_active' then is_active::text when 'created_at' then created_at::text
        else public.normalize_document_search(to_jsonb(f)->>p_sort) end end desc nulls last,
      name,id
    limit p_page_size offset ((select page from paging)-1)*p_page_size
  ), page_rows as (
    select v.*, row_number() over () as page_position from visible v
  )
  select jsonb_build_object('total',p.total,'page',p.page,
    'items',coalesce((select jsonb_agg((to_jsonb(v) - 'page_position') || jsonb_build_object(
      'base_cost',pb.base_cost,'main_price_original',price.calculated_price,'main_price_list_name',price.name) order by v.page_position)
      from page_rows v left join public.item_pricing_base pb on pb.company_id = p_company_id and pb.item_id = v.id
      left join lateral (
        select pi.calculated_price,pl.name from public.price_list_items pi
        join public.price_lists pl on pl.id = pi.price_list_id and pl.company_id = p_company_id
        where pi.company_id = p_company_id and pi.item_id = v.id and pi.is_active
        order by (pl.status = 'UPDATED') desc,pl.name,pl.id limit 1
      ) price on true),'[]'::jsonb),
    'stats',(select jsonb_build_object('total',count(*),'active',count(*) filter(where is_active),
      'inStock',count(*) filter(where is_active and stock > 0),'noStock',count(*) filter(where is_active and stock <= 0)) from catalog),
    'categories',coalesce((select jsonb_agg(category order by category) from
      (select distinct category from catalog where category is not null) c),'[]'::jsonb),
    'suppliers',coalesce((select jsonb_agg(supplier order by supplier) from
      (select distinct supplier from catalog where supplier is not null) s),'[]'::jsonb))
  into v_result from paging p;
  return v_result;
end;
$$;
revoke all on function public.list_items_page(uuid,text,text,text,text,text,text,text,integer,integer) from public, anon;
grant execute on function public.list_items_page(uuid,text,text,text,text,text,text,text,integer,integer) to authenticated;

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
      coalesce(sum(public.stock_quantity_delta(sm.type::text, sm.quantity)), 0) as total,
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

commit;
