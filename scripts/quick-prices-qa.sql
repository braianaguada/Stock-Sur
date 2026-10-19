-- Staging only: npx supabase db query --linked --file scripts/quick-prices-qa.sql
-- Temporary fixtures only, rollback removes products, list and stock movements.
begin;
do $$
declare actor uuid; company uuid; list_id uuid := gen_random_uuid(); marker text := 'qa-price-' || gen_random_uuid(); target uuid;
begin
  select cu.user_id,cu.company_id into actor,company from public.company_users cu
  join public.companies c on c.id = cu.company_id and c.status = 'ACTIVE'
  where public.is_company_member(cu.user_id,cu.company_id) limit 1;
  if actor is null then raise exception 'Active staging member required'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('qa.price_company',company::text,true);
  perform set_config('qa.price_list',list_id::text,true);
  perform set_config('qa.price_marker',marker,true);
  insert into public.price_lists(id,company_id,name) values(list_id,company,marker);
  insert into public.items(company_id,sku,name,unit,is_active)
    select company,marker || n,marker || n,'un',true from generate_series(1,1205) n;
  insert into public.price_list_items(company_id,price_list_id,item_id,base_cost,calculated_price)
    select company,list_id,id,10,20 from public.items where company_id = company and sku like marker || '%'
    on conflict (price_list_id,item_id) do update set base_cost=10,calculated_price=20;
  select id into target from public.items where company_id = company and sku = marker || '1';
  insert into public.stock_movements(company_id,item_id,type,quantity,reference,created_by)
    values(company,target,'IN',10,marker,actor),(company,target,'OUT',3,marker,actor),(company,target,'ADJUSTMENT',-2,marker,actor);
end $$;
set local role authenticated;
do $$
declare company uuid := current_setting('qa.price_company')::uuid; list_id uuid := current_setting('qa.price_list')::uuid;
  marker text := current_setting('qa.price_marker'); p jsonb; ids uuid[]; nextids uuid[];
begin
  p := public.search_quick_prices(company,list_id,marker);
  if jsonb_array_length(p->'items') <> 30 or not (p->>'hasMore')::boolean then raise exception 'Unbounded first page'; end if;
  if not exists(select 1 from jsonb_array_elements(p->'items') r where r->>'sku' = marker || '1' and (r->>'stock')::numeric = 5
    and (r->>'calculated_price')::numeric = 20) then raise exception 'Wrong stock or price'; end if;
  select array_agg((r->>'item_id')::uuid) into ids from jsonb_array_elements(p->'items') r;
  p := public.search_quick_prices(company,list_id,marker,2);
  select array_agg((r->>'item_id')::uuid) into nextids from jsonb_array_elements(p->'items') r;
  if ids && nextids then raise exception 'Overlapping pages'; end if;
  p := public.search_quick_prices(company,list_id,marker,41);
  if jsonb_array_length(p->'items') <> 5 or (p->>'hasMore')::boolean then raise exception 'Truncation beyond 1000'; end if;
  p := public.search_quick_prices(company,list_id,'');
  if jsonb_array_length(p->'items') <> 0 then raise exception 'Empty search downloads catalog'; end if;
  begin perform public.search_quick_prices(gen_random_uuid(),list_id,marker); raise exception 'Foreign company accepted';
    exception when insufficient_privilege then null; end;
  begin perform public.search_quick_prices(company,gen_random_uuid(),marker); raise exception 'Foreign list accepted';
    exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','',true);
  begin perform public.search_quick_prices(company,list_id,marker); raise exception 'Anonymous accepted';
    exception when insufficient_privilege then null; end;
  raise notice 'PASS: selected list, shared stock, 1205 products, stable pages, empty search and tenant access';
end $$;
rollback;
