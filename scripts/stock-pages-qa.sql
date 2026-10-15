-- Staging only: npx supabase db query --linked --file scripts/stock-pages-qa.sql
-- Temporary products/movements, no documents or cash. Entire transaction rolls back.
begin;
do $$
declare actor uuid; company uuid; target uuid; marker text := 'qa-stock-' || gen_random_uuid();
begin
  select cu.user_id,cu.company_id into actor,company from public.company_users cu
  join public.companies c on c.id = cu.company_id and c.status = 'ACTIVE'
  where public.is_company_member(cu.user_id,cu.company_id) limit 1;
  if actor is null then raise exception 'Active staging member required'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('qa.stock_company',company::text,true);
  perform set_config('qa.stock_marker',marker,true);
  insert into public.items(company_id,sku,name,unit,is_active)
  select company,marker || n,marker || n,'un',true from generate_series(1,1205) n;
  select id into target from public.items where sku = marker || '1' and company_id = company;
  insert into public.stock_movements(company_id,item_id,type,quantity,reference,created_by)
  select company,target,'IN',1,marker,actor from generate_series(1,5005);
  insert into public.stock_movements(company_id,item_id,type,quantity,reference,created_by)
  values(company,target,'OUT',5,marker,actor),(company,target,'ADJUSTMENT',-2,marker,actor);
end $$;
set local role authenticated;
do $$
declare company uuid := current_setting('qa.stock_company')::uuid;
  marker text := current_setting('qa.stock_marker'); payload jsonb; overview jsonb; ids uuid[]; nextids uuid[];
begin
  overview := public.get_stock_overview(company);
  if (select count(*) from jsonb_array_elements(overview) r where r->>'item_sku' like marker || '%') <> 1205 then
    raise exception 'Overview truncated beyond 1000'; end if;
  if not exists(select 1 from jsonb_array_elements(overview) r where r->>'item_sku' = marker || '1'
    and (r->>'total')::numeric = 4998 and (r->>'avg_daily_out_30d')::numeric between 0.1666666 and 0.1666667
    and r->>'health' = 'GREEN') then raise exception 'Stock balance or demand incorrect'; end if;
  payload := public.list_stock_movements_page(company,marker);
  if (payload->>'total')::int <> 5007 or jsonb_array_length(payload->'items') <> 10 then
    raise exception 'History truncated or page unbounded'; end if;
  select array_agg((r->>'id')::uuid) into ids from jsonb_array_elements(payload->'items') r;
  payload := public.list_stock_movements_page(company,marker,2);
  select array_agg((r->>'id')::uuid) into nextids from jsonb_array_elements(payload->'items') r;
  if ids && nextids then raise exception 'Pages overlap'; end if;
  payload := public.list_stock_movements_page(company,marker,9999);
  if (payload->>'page')::int <> 501 or jsonb_array_length(payload->'items') <> 7 then
    raise exception 'Final page incorrect'; end if;
  begin
    perform public.get_stock_overview(gen_random_uuid());
    raise exception 'Foreign company accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.list_stock_movements_page(company,p_page_size => 201);
    raise exception 'Oversized page accepted';
  exception when invalid_parameter_value then null; end;
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.list_stock_movements_page(company);
    raise exception 'Missing identity accepted';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS: complete overview, shared balance, demand, 5007 history rows, stable pages and access';
end $$;
rollback;
