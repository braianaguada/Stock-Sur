begin;

create index if not exists stock_movements_company_page_idx
  on public.stock_movements(company_id, created_at desc, id desc);

-- JSON avoids the PostgREST row cap on the complete aggregate overview.
-- Raw historical movements are never returned by this endpoint.
create function public.get_stock_overview(p_company_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = public, pg_temp
as $$
declare result jsonb;
begin
  if auth.uid() is null or not public.is_company_member(auth.uid(), p_company_id)
    or not exists(select 1 from public.companies where id = p_company_id and status = 'ACTIVE') then
    raise exception 'Sin acceso al stock de esta empresa' using errcode = '42501';
  end if;
  with summary as materialized (select * from public.get_stock_summary(p_company_id)),
  demand as (
    select s.*, out_30d/30 as avg_daily_out_30d, out_90d/90 as avg_daily_out_90d,
      out_365d/365 as avg_daily_out_365d,
      greatest(out_365d/365, out_30d/30*0.5 + out_90d/90*0.3 + out_365d/365*0.2) as demand_daily,
      (select min(v) from unnest(array[
        (select v from unnest(s.out_month_buckets_12m) v order by v offset 3 limit 1),
        s.out_365d/12, s.out_90d/3]) v where v > 0) as low_monthly
    from summary s
  ), coverage as (
    select d.*, total/nullif(demand_daily,0) as days_of_cover,
      total/nullif(low_monthly,0) as months_of_cover_low_rotation from demand d
  )
  select coalesce(jsonb_agg((to_jsonb(c) - 'out_30d' - 'out_90d' - 'out_365d'
    - 'out_month_buckets_12m' - 'low_monthly') || jsonb_build_object(
      'low_rotation',demand_profile = 'LOW',
      'health',case when total <= 0 then 'RED'
        when demand_profile = 'LOW' then case when total <= 2 then 'YELLOW' else 'GREEN' end
        when days_of_cover < case when demand_profile = 'HIGH' then 15 else 10 end then 'RED'
        when days_of_cover < case when demand_profile = 'HIGH' then 30 else 20 end then 'YELLOW'
        else 'GREEN' end) order by item_name,item_id), '[]'::jsonb)
  into result from coverage c;
  return result;
end $$;

create function public.list_stock_movements_page(
  p_company_id uuid, p_search text default '', p_page integer default 1, p_page_size integer default 10
)
returns jsonb language plpgsql stable security invoker set search_path = public, pg_temp
as $$
declare result jsonb;
begin
  if auth.uid() is null or not public.is_company_member(auth.uid(), p_company_id)
    or not exists(select 1 from public.companies where id = p_company_id and status = 'ACTIVE') then
    raise exception 'Sin acceso a movimientos de esta empresa' using errcode = '42501';
  end if;
  if p_page is null or p_page < 1 or p_page_size is null or p_page_size not between 1 and 200 then
    raise exception 'Pagina de movimientos invalida' using errcode = '22023';
  end if;
  with filtered as materialized (
    select m.id,m.item_id,m.type,m.quantity,m.reference,m.created_by,m.created_at,
      coalesce(nullif(p.full_name,''),left(m.created_by::text,8),'Sistema') as created_by_name,
      jsonb_build_object('name',i.name,'sku',i.sku,'unit',i.unit,
        'brand',i.brand,'model',i.model,'attributes',i.attributes) as items
    from public.stock_movements m
    join public.items i on i.id = m.item_id and i.company_id = m.company_id
    left join public.profiles p on p.user_id = m.created_by
    where m.company_id = p_company_id
      and public.catalog_search_matches(p_search,concat_ws(' ',m.reference,
        coalesce(nullif(p.full_name,''),left(m.created_by::text,8),'Sistema'),
        i.name,i.sku,i.brand,i.model,i.attributes))
  ), paging as (
    select count(*) as total,least(p_page::bigint,greatest(1::bigint,
      (count(*)+p_page_size-1)/p_page_size)) as page from filtered
  ), visible as (
    select * from filtered order by created_at desc,id desc
    limit p_page_size offset ((select page from paging)-1)*p_page_size
  )
  select jsonb_build_object('total',p.total,'page',p.page,
    'items',coalesce((select jsonb_agg(to_jsonb(v) order by created_at desc,id desc) from visible v),'[]'::jsonb))
  into result from paging p;
  return result;
end $$;

revoke all on function public.get_stock_overview(uuid) from public,anon;
revoke all on function public.list_stock_movements_page(uuid,text,integer,integer) from public,anon;
grant execute on function public.get_stock_overview(uuid) to authenticated;
grant execute on function public.list_stock_movements_page(uuid,text,integer,integer) to authenticated;
commit;
