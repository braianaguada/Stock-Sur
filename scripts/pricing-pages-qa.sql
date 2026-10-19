-- Staging only: npx supabase db query --linked --file scripts/pricing-pages-qa.sql
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
  insert into public.item_pricing_base(company_id,item_id,base_cost) values(company,target,12)
    on conflict(company_id,item_id) do update set base_cost=12;
  insert into public.item_pricing_base_history(company_id,item_id,previous_base_cost,new_base_cost,changed_at,changed_by)
    values(company,target,8,10,now()-interval '2 days',actor),(company,target,10,12,now()+interval '1 day',actor);
  insert into public.stock_movements(company_id,item_id,type,quantity,reference,created_by)
    values(company,target,'IN',10,marker,actor),(company,target,'OUT',3,marker,actor),(company,target,'ADJUSTMENT',-2,marker,actor);
end $$;
set local role authenticated;
do $$
declare company uuid := current_setting('qa.price_company')::uuid; list_id uuid := current_setting('qa.price_list')::uuid;
 marker text := current_setting('qa.price_marker'); p jsonb; ids uuid[]; nextids uuid[];
begin
 p := public.list_pricing_items_page(company,list_id,marker,1,30);
 if (p->'items'->0->>'base_cost')::numeric <> 12 or (p->'items'->0->>'previous_base_cost')::numeric <> 10 or (p->'items'->0->>'cost_variation_pct')::numeric <> 20 then raise exception 'Latest cost history incorrect'; end if;
 if (p->>'totalItems')::int <> 1205 or jsonb_array_length(p->'items') <> 30 then raise exception 'Unbounded page'; end if;
 select array_agg((r->>'item_id')::uuid) into ids from jsonb_array_elements(p->'items') r;
 p := public.list_pricing_items_page(company,list_id,marker,2,30);
 select array_agg((r->>'item_id')::uuid) into nextids from jsonb_array_elements(p->'items') r;
 if ids && nextids then raise exception 'Overlapping pages'; end if;
 p := public.list_pricing_items_page(company,list_id,marker,41,30);
 if jsonb_array_length(p->'items') <> 5 then raise exception 'Truncation beyond 1000'; end if;
 p := public.list_pricing_items_page(company,list_id,marker,1,30,'in_stock');
 if (p->>'totalItems')::int <> 1 or (p->'items'->0->>'stock')::numeric <> 5 then raise exception 'Stock filter must precede pagination'; end if;
 p := public.list_pricing_items_page(company,list_id,marker,1,30,'no_stock');
 if (p->>'totalItems')::int <> 1204 then raise exception 'Wrong no-stock filter'; end if;
 p := public.get_price_list_metrics(company,list_id);
 if not exists(select 1 from jsonb_array_elements(p->'counts') r where r->>'price_list_id'=list_id::text and (r->>'total')::int=(select count(*) from public.price_list_items where company_id=company and price_list_id=list_id and is_active)) then raise exception 'Wrong list count'; end if;
 begin perform public.list_pricing_items_page(gen_random_uuid(),list_id,marker); raise exception 'Foreign company accepted'; exception when insufficient_privilege then null; end;
 begin perform public.get_price_list_metrics(company,gen_random_uuid()); raise exception 'Foreign list accepted'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.list_pricing_items_page(company,list_id,marker); raise exception 'Anonymous accepted'; exception when insufficient_privilege then null; end;
 raise notice 'PASS: bounded pricing pages, 1205 products, stock filtering before pagination, selected list counts and access';
end $$;
rollback;
