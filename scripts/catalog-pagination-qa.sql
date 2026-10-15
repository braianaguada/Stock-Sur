-- STAGING ONLY. Temporary catalog records are rolled back. No stock/cash/document is created.
-- npx supabase db query --linked --file scripts/catalog-pagination-qa.sql
begin;
do $$
declare actor uuid; company uuid; marker text := 'qa-catalog-' || gen_random_uuid(); target uuid;
begin
  select cu.user_id, cu.company_id into actor, company from public.company_users cu
  join public.companies c on c.id = cu.company_id and c.status = 'ACTIVE'
  where public.is_company_member(cu.user_id, cu.company_id) limit 1;
  if actor is null then raise exception 'Active staging member required'; end if;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('qa.catalog_company', company::text, true);
  perform set_config('qa.catalog_marker', marker, true);
  insert into public.items(company_id, sku, name, unit, category, supplier, is_active)
  select company, marker || '-' || n, case when n = 1205 then 'Tubo 1/2 Álvarez' else 'Producto ' || lpad(n::text,4,'0') end,
    'un', marker, marker, n <> 1204 from generate_series(1,1205) n;
  select id into target from public.items where company_id = company and sku = marker || '-1205';
  insert into public.item_aliases(company_id,item_id,alias,is_supplier_code)
  values(company,target,marker || '-alias',true);
end $$;
set local role authenticated;
do $$
declare company uuid := current_setting('qa.catalog_company')::uuid;
  marker text := current_setting('qa.catalog_marker'); payload jsonb; ids uuid[]; next_ids uuid[];
begin
  payload := public.list_items_page(company,p_category => marker,p_status => 'all');
  if (payload->>'total')::int <> 1205 or jsonb_array_length(payload->'items') <> 10 then
    raise exception 'Catalog count or bounded page failed'; end if;
  select array_agg((r->>'id')::uuid) into ids from jsonb_array_elements(payload->'items') r;
  payload := public.list_items_page(company,p_category => marker,p_status => 'all',p_page => 2);
  select array_agg((r->>'id')::uuid) into next_ids from jsonb_array_elements(payload->'items') r;
  if ids && next_ids then raise exception 'Pages overlap'; end if;
  payload := public.list_items_page(company,p_category => marker,p_status => 'all',p_page => 999);
  if (payload->>'page')::int <> 121 or jsonb_array_length(payload->'items') <> 5 then
    raise exception 'Final page incorrect'; end if;
  payload := public.list_items_page(company,p_category => marker,p_search => 'caño media alvarez');
  if (payload->>'total')::int <> 1 then raise exception 'Natural search failed beyond first 1000'; end if;
  payload := public.list_items_page(company,p_search => marker || '-alias');
  if (payload->>'total')::int <> 1 then raise exception 'Supplier alias search failed'; end if;
  payload := public.list_items_page(company,p_category => marker,p_status => 'inactive');
  if (payload->>'total')::int <> 1 then raise exception 'Inactive filter failed'; end if;
  payload := public.list_items_page(company,p_category => marker,p_stock => 'in_stock');
  if (payload->>'total')::int <> 0 then raise exception 'Stock filter failed'; end if;
  payload := public.list_items_page(company,p_category => marker,p_supplier => 'nonexistent');
  if (payload->>'total')::int <> 0 then raise exception 'Supplier filter failed'; end if;
  -- Both catalog and Stock must report the same balance, under the caller's RLS.
  payload := public.list_items_page(company,p_page_size => 200);
  if exists(select 1 from jsonb_array_elements(payload->'items') r
    join public.get_stock_summary(company) s on s.item_id = (r->>'id')::uuid
    where (r->>'stock')::numeric <> s.total) then raise exception 'Stock balance differs'; end if;
  begin
    perform public.list_items_page(gen_random_uuid());
    raise exception 'Foreign company accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.list_items_page(company,p_page_size => 201);
    raise exception 'Unbounded page accepted';
  exception when invalid_parameter_value then null; end;
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.list_items_page(company);
    raise exception 'Missing identity accepted';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS: 1205 items, pages, aliases, natural search, filters, shared stock balance and access guards';
end $$;
rollback;
