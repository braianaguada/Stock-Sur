begin;
create index if not exists pricing_active_list_item_lookup_idx
  on public.price_list_items(company_id,price_list_id,item_id) where is_active;
create function public.search_quick_prices(
  p_company_id uuid, p_price_list_id uuid, p_search text, p_page integer default 1
) returns jsonb language plpgsql stable security invoker set search_path = public, pg_temp
as $$
declare result jsonb;
begin
  if auth.uid() is null or not public.is_company_member(auth.uid(),p_company_id)
    or not exists(select 1 from public.companies where id = p_company_id and status = 'ACTIVE') then
    raise exception 'Sin acceso a los precios de esta empresa' using errcode = '42501';
  end if;
  if p_page is null or p_page < 1 then
    raise exception 'Pagina invalida' using errcode = '22023';
  end if;
  if not exists(select 1 from public.price_lists where company_id = p_company_id and id = p_price_list_id) then
    raise exception 'La lista no pertenece a la empresa activa' using errcode = '42501';
  end if;
  if btrim(coalesce(p_search,'')) = '' then
    return jsonb_build_object('items','[]'::jsonb,'hasMore',false);
  end if;
  with matches as materialized (
    select i.id as item_id,i.sku,i.name,i.attributes,i.brand,i.model,i.category,i.unit,
      null::numeric as previous_base_cost,pi.base_cost,null::numeric as cost_variation_pct,
      pi.calculated_price,pi.final_price_override,pi.manual_price_enabled,pi.manual_price_note,
      pi.manual_price_updated_at,pi.manual_price_updated_by,pi.needs_recalculation,
      pi.last_calculated_at,pi.last_calculated_by
    from public.price_list_items pi join public.items i on i.id = pi.item_id and i.company_id = p_company_id
    where pi.company_id = p_company_id and pi.price_list_id = p_price_list_id and pi.is_active and i.is_active
      and public.catalog_search_matches(p_search,concat_ws(' ',i.id,i.sku,i.name,i.attributes,i.brand,i.model,i.category,i.unit,
        (select string_agg(a.alias,' ') from public.item_aliases a where a.company_id = p_company_id and a.item_id = i.id)))
    order by i.name,i.id limit 31 offset (p_page::bigint-1)*30
  ), visible as materialized (select * from matches order by name,item_id limit 30)
  select jsonb_build_object('hasMore',(select count(*) > 30 from matches),
    'items',coalesce((select jsonb_agg(to_jsonb(v) || jsonb_build_object('stock',coalesce(s.stock,0)) order by v.name,v.item_id)
      from visible v left join lateral (
        select sum(public.stock_quantity_delta(sm.type::text,sm.quantity)) as stock from public.stock_movements sm
        where sm.company_id = p_company_id and sm.item_id = v.item_id
      ) s on true),'[]'::jsonb)) into result;
  return result;
end $$;
revoke all on function public.search_quick_prices(uuid,uuid,text,integer) from public, anon;
grant execute on function public.search_quick_prices(uuid,uuid,text,integer) to authenticated;
commit;
