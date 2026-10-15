-- STAGING ONLY. All temporary drafts are rolled back; no document is issued.
-- npm run db:link:staging
-- npx supabase db query --linked --file scripts/documents-pagination-qa.sql
begin;
do $$
declare actor uuid; company uuid; marker text := 'qa-pagination-' || gen_random_uuid();
begin
  select cu.user_id, cu.company_id into actor, company from public.company_users cu
  join public.companies c on c.id = cu.company_id and c.status = 'ACTIVE'
  where public.is_company_member(cu.user_id, cu.company_id)
    and public.has_company_permission(cu.user_id, cu.company_id, 'documents.view') limit 1;
  if actor is null then raise exception 'An active staging member with documents.view is required'; end if;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('qa.pagination_company', company::text, true);
  perform set_config('qa.pagination_marker', marker, true);
  insert into public.documents (company_id, doc_type, status, customer_name, notes, issue_date, created_by, created_at)
  select company, 'PRESUPUESTO', 'BORRADOR', case when n = 1205 then 'Histórico Álvarez' else 'Reciente' end,
    marker, '2026-09-15', actor, '2026-09-15'::timestamptz + n * interval '1 second'
  from generate_series(1, 1205) n;
end $$;
set local role authenticated;
do $$
declare company uuid := current_setting('qa.pagination_company')::uuid;
  marker text := current_setting('qa.pagination_marker'); payload jsonb; first_ids uuid[]; last_ids uuid[];
  ids uuid[]; expected uuid[]; actual uuid[];
begin
  payload := public.list_documents_page(company, marker, p_page => 1, p_page_size => 10);
  if (payload->>'total')::int <> 1205 or jsonb_array_length(payload->'rows') <> 10 then
    raise exception 'Full history count or page size incorrect'; end if;
  select array_agg((r->>'id')::uuid) into first_ids from jsonb_array_elements(payload->'rows') r;
  payload := public.list_documents_page(company, marker, p_page => 2, p_page_size => 10);
  select array_agg((r->>'id')::uuid) into last_ids from jsonb_array_elements(payload->'rows') r;
  if first_ids && last_ids then raise exception 'Pages overlap'; end if;
  payload := public.list_documents_page(company, marker, p_page => 999, p_page_size => 10);
  if (payload->>'page')::int <> 121 or jsonb_array_length(payload->'rows') <> 5 then
    raise exception 'Last page clamp incorrect'; end if;
  payload := public.list_documents_page(company, 'historico alvarez', p_type => 'PRESUPUESTO', p_status => 'BORRADOR', p_date_from => '2026-09-15', p_date_to => '2026-09-15', p_page_size => 200);
  if not exists (select 1 from jsonb_array_elements(payload->'rows') r where r->>'notes' = marker) then
    raise exception 'Accent-insensitive search or inclusive dates failed'; end if;
  payload := public.list_documents_page(company, marker, p_date_to => '2026-09-14');
  if (payload->>'total')::int <> 0 then raise exception 'Date filter ignored'; end if;
  payload := public.list_documents_page(company, marker, p_type => 'REMITO');
  if (payload->>'total')::int <> 0 then raise exception 'Type filter ignored'; end if;
  payload := public.list_documents_page(company, marker, p_status => 'EMITIDO');
  if (payload->>'total')::int <> 0 then raise exception 'Status filter ignored'; end if;
  -- Compare bounded cash usage to the pre-existing business rule, under authenticated RLS.
  select array_agg(id) into ids from (select id from public.documents where company_id = company order by created_at desc limit 200) d;
  select array_agg(d.id order by d.id) into expected from public.documents d where d.company_id = company and d.id = any(ids)
    and exists (select 1 from public.cash_sales c where c.company_id = company and c.status <> 'ANULADA'
      and (c.document_id = d.id or (c.receipt_kind = 'FACTURA' and nullif(btrim(d.external_invoice_number), '') is not null
        and btrim(c.receipt_reference) = btrim(d.external_invoice_number))));
  select array_agg(document_id order by document_id) into actual from public.documents_page_cash_usage(company, ids);
  if actual is distinct from expected then raise exception 'Cash usage differs'; end if;
  begin
    perform public.list_documents_page(gen_random_uuid());
    raise exception 'Foreign company accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.documents_page_cash_usage(gen_random_uuid(), ids);
    raise exception 'Foreign company cash accepted';
  exception when insufficient_privilege then null; end;
  begin
    perform public.list_documents_page(company, p_page_size => 201);
    raise exception 'Unbounded page accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.list_documents_page(company, p_date_from => '2026-10-01', p_date_to => '2026-09-01');
    raise exception 'Inverted dates accepted';
  exception when invalid_parameter_value then null; end;
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.list_documents_page(company);
    raise exception 'Missing identity accepted';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS: 1205 drafts, bounded pages, full-history search, dates, cash, authenticated RLS and access guards';
end $$;
rollback;
