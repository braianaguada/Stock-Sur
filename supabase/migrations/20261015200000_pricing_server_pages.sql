begin;
create index if not exists pricing_base_history_latest_idx on public.item_pricing_base_history(company_id,item_id,changed_at desc);
create function public.list_pricing_items_page(
 p_company_id uuid,p_list_id uuid default null,p_search text default '',p_page integer default 1,
 p_page_size integer default 10,p_stock_filter text default 'all'
) returns jsonb language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.is_company_member(auth.uid(),p_company_id)
  or not exists(select 1 from public.companies where id=p_company_id and status='ACTIVE') then
  raise exception 'Sin acceso a los precios de esta empresa' using errcode='42501';
 end if;
 if p_page is null or p_page<1 or p_page_size is null or p_page_size<1 or p_page_size>200
  or p_stock_filter is null or p_stock_filter not in ('all','in_stock','no_stock') then
  raise exception 'Paginacion o filtro invalido' using errcode='22023';
 end if;
 if p_list_id is not null and not exists(select 1 from public.price_lists where company_id=p_company_id and id=p_list_id) then
  raise exception 'La lista no pertenece a la empresa activa' using errcode='42501';
 end if;
 with matches as materialized (
  select i.id from public.items i where i.company_id=p_company_id and i.is_active
   and (btrim(coalesce(p_search,''))='' or public.catalog_search_matches(p_search,concat_ws(' ',i.id,i.sku,i.name,i.attributes,i.brand,i.model,i.category,i.unit,
    (select string_agg(a.alias,' ') from public.item_aliases a where a.company_id=p_company_id and a.item_id=i.id))))
   and (p_stock_filter='all' or case when p_stock_filter='in_stock' then
    coalesce((select sum(public.stock_quantity_delta(s.type::text,s.quantity)) from public.stock_movements s where s.company_id=p_company_id and s.item_id=i.id),0)>0
    else coalesce((select sum(public.stock_quantity_delta(s.type::text,s.quantity)) from public.stock_movements s where s.company_id=p_company_id and s.item_id=i.id),0)<=0 end)
 ), totals as (select count(*) as total from matches), bounds as (
  select total,greatest(1,ceil(total::numeric/p_page_size)::integer) as pages from totals
 ), visible as materialized (
  select i.id,i.sku,i.name,i.attributes,i.brand,i.model,i.category,i.unit from matches m join public.items i on i.id=m.id and i.company_id=p_company_id order by i.name,i.id
  limit p_page_size offset ((select least(p_page,pages) from bounds)::bigint-1)*p_page_size
 ), rows as (
  select i.id as item_id,i.sku,i.name,i.attributes,i.brand,i.model,i.category,i.unit,
   coalesce(b.base_cost,0) as base_cost,h.previous_base_cost,
   case when h.previous_base_cost>0 then (coalesce(b.base_cost,0)-h.previous_base_cost)/h.previous_base_cost*100 end as cost_variation_pct,
   b.updated_at,b.updated_by,coalesce(pi.calculated_price,0) as calculated_price,pi.final_price_override,
   coalesce(pi.manual_price_enabled,false) as manual_price_enabled,pi.manual_price_note,pi.manual_price_updated_at,pi.manual_price_updated_by,
   coalesce(pi.needs_recalculation,true) as needs_recalculation,pi.last_calculated_at,pi.last_calculated_by,
   coalesce(s.stock,0) as stock
  from visible i left join public.item_pricing_base b on b.company_id=p_company_id and b.item_id=i.id
  left join lateral (select previous_base_cost from public.item_pricing_base_history where company_id=p_company_id and item_id=i.id order by changed_at desc,id desc limit 1) h on true
  left join public.price_list_items pi on pi.company_id=p_company_id and pi.price_list_id=p_list_id and pi.item_id=i.id and pi.is_active
  left join lateral (select sum(public.stock_quantity_delta(type::text,quantity)) as stock from public.stock_movements where company_id=p_company_id and item_id=i.id) s on true
 ) select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(r) order by name,item_id) from rows r),'[]'::jsonb),
  'totalItems',total,'totalPages',pages,'page',least(p_page,pages)) into result from bounds;
 return result;
end $$;
revoke all on function public.list_pricing_items_page(uuid,uuid,text,integer,integer,text) from public,anon;
grant execute on function public.list_pricing_items_page(uuid,uuid,text,integer,integer,text) to authenticated;

create function public.get_price_list_metrics(p_company_id uuid,p_list_id uuid default null,p_round_enabled boolean default false,p_round_increment numeric default 100)
returns jsonb language plpgsql stable security invoker set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.is_company_member(auth.uid(),p_company_id)
  or not exists(select 1 from public.companies where id=p_company_id and status='ACTIVE') then
  raise exception 'Sin acceso a los precios de esta empresa' using errcode='42501';
 end if;
 if p_list_id is not null and not exists(select 1 from public.price_lists where company_id=p_company_id and id=p_list_id) then
  raise exception 'La lista no pertenece a la empresa activa' using errcode='42501';
 end if;
 with counts as (
  select price_list_id,count(*) as total,count(*) filter(where needs_recalculation) as pending
  from public.price_list_items where company_id=p_company_id and is_active group by price_list_id
 ), prices as (
  select coalesce(b.base_cost,0) as cost,l.flete_pct,l.impuesto_pct,l.utilidad_pct,
   case when pi.manual_price_enabled and pi.final_price_override>=0 then pi.final_price_override
    when p_round_enabled and p_round_increment in (100,500,1000) and pi.calculated_price>0 then round(pi.calculated_price/p_round_increment)*p_round_increment
    else coalesce(pi.calculated_price,0) end as price
  from public.items i join public.price_lists l on l.company_id=p_company_id and l.id=p_list_id
  left join public.item_pricing_base b on b.company_id=p_company_id and b.item_id=i.id
  left join public.price_list_items pi on pi.company_id=p_company_id and pi.price_list_id=p_list_id and pi.item_id=i.id and pi.is_active
  where i.company_id=p_company_id and i.is_active
 ), margins as (
  select case when cost>0 and price>0 then (1-cost*(1+greatest(0,flete_pct)/100)/(price/(1+greatest(0,impuesto_pct)/100)))*100 end as margin,
   greatest(0,utilidad_pct)/(100+greatest(0,utilidad_pct))*100 as target from prices
 ) select jsonb_build_object('counts',coalesce((select jsonb_agg(to_jsonb(c)) from counts c),'[]'::jsonb),
  'marginSummary',case when p_list_id is null then null else (select jsonb_build_object(
   'evaluableCount',count(margin),'belowTargetCount',count(*) filter(where margin<target-0.05),
   'missingCostCount',count(*) filter(where margin is null),'negativeMarginCount',count(*) filter(where margin<0),
   'averageMarginPct',avg(margin)) from margins) end) into result;
 return result;
end $$;
revoke all on function public.get_price_list_metrics(uuid,uuid,boolean,numeric) from public,anon;
grant execute on function public.get_price_list_metrics(uuid,uuid,boolean,numeric) to authenticated;
commit;
