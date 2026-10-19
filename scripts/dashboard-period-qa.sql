-- Staging only: npm run db:link:staging
-- npx supabase db query --linked --file scripts/dashboard-period-qa.sql
-- Read-only assertions; no credentials, documents or business records are written.
begin transaction read only;
do $$
declare
  actor uuid;
  company uuid;
  payload jsonb;
  products jsonb;
  expected numeric;
  actual numeric;
  item jsonb;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.get_dashboard_period_product_insights(gen_random_uuid(), '2026-09-01', '2026-09-30');
    raise exception 'Anonymous product access accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.get_dashboard_timeseries(gen_random_uuid(), 'day', '2026-09-01', '2026-09-30');
    raise exception 'Anonymous timeseries access accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.get_dashboard_period_product_insights(gen_random_uuid(), '2024-01-01', '2025-01-01');
    raise exception 'Oversized inclusive range accepted';
  exception when invalid_parameter_value then null;
  end;

  select cu.user_id, cu.company_id into actor, company
  from public.company_users cu
  where public.is_company_member(cu.user_id, cu.company_id)
    and public.has_company_permission(cu.user_id, cu.company_id, 'cash.view')
  limit 1;
  if actor is null then raise exception 'QA requires an active staging member with cash.view'; end if;
  perform set_config('request.jwt.claim.sub', actor::text, true);

  payload := public.get_dashboard_timeseries(company, 'day', '2026-09-01', '2026-09-30');
  products := public.get_dashboard_period_product_insights(company, '2026-09-01', '2026-09-30');
  if jsonb_array_length(payload->'buckets') <> 30 then raise exception 'Missing date buckets'; end if;
  select coalesce(sum(amount_total), 0) into expected from public.cash_sales
    where company_id = company and business_date between '2026-09-01' and '2026-09-30' and status <> 'ANULADA';
  select coalesce(sum((b->>'sales')::numeric), 0) into actual from jsonb_array_elements(payload->'buckets') b;
  if actual <> expected then raise exception 'Cash totals mismatch'; end if;
  select coalesce(sum((m->>'total')::numeric), 0) into actual from jsonb_array_elements(payload->'paymentMethods') m;
  if actual <> expected then raise exception 'Payment method totals mismatch'; end if;
  select coalesce(sum((case when d.doc_type = 'REMITO_DEVOLUCION' then -1 else 1 end) * coalesce(dl.line_total, dl.quantity * dl.unit_price, 0)), 0)
    into expected from public.documents d join public.document_lines dl on dl.document_id = d.id
    where d.company_id = company and d.issue_date between '2026-09-01' and '2026-09-30'
      and d.status = 'EMITIDO' and d.doc_type in ('REMITO', 'REMITO_DEVOLUCION')
      and coalesce(d.customer_kind, 'GENERAL') <> 'INTERNO';
  if (products->'totals'->>'revenue')::numeric <> expected then raise exception 'Product totals mismatch'; end if;
  for item in select value from jsonb_array_elements(products->'topItems') loop
    if not (item ?& array['brand', 'model', 'attributes']) then raise exception 'Missing variant metadata'; end if;
    if exists (select 1 from public.items i where i.id = (item->>'itemId')::uuid and i.company_id = company
      and (to_jsonb(i.attributes) is distinct from nullif(item->'attributes', 'null'::jsonb))) then
      raise exception 'Variant attributes mismatch';
    end if;
  end loop;
  begin
    perform public.get_dashboard_period_product_insights(gen_random_uuid(), '2026-09-01', '2026-09-30');
    raise exception 'Foreign company product access accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.get_dashboard_timeseries(gen_random_uuid(), 'day', '2026-09-01', '2026-09-30');
    raise exception 'Foreign company timeseries access accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
select 'PASS: bounded RPCs, attributes, company permissions, cash/payment/product totals' as result;
rollback;
