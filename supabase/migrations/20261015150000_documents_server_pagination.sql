begin;

-- Match the existing accent-insensitive browser search without downloading the history.
create function public.normalize_document_search(p_value text)
returns text language sql immutable parallel safe
set search_path = public, pg_temp
as $$
  select btrim(regexp_replace(
    regexp_replace(
      regexp_replace(normalize(lower(coalesce(p_value, '')), NFD), U&'[\0300-\036f]', '', 'g'),
      '[^a-z0-9/+[:space:].-]', ' ', 'g'),
    '[[:space:]]+', ' ', 'g'));
$$;

create index if not exists documents_company_created_page_idx
  on public.documents (company_id, created_at desc, id desc);
create index if not exists cash_sales_company_document_active_idx
  on public.cash_sales (company_id, document_id) where status <> 'ANULADA';
create index if not exists cash_sales_company_invoice_reference_active_idx
  on public.cash_sales (company_id, btrim(receipt_reference))
  where status <> 'ANULADA' and receipt_kind = 'FACTURA';

create function public.list_documents_page(
  p_company_id uuid, p_search text default '', p_type text default 'ALL',
  p_status text default 'ALL', p_customer_id uuid default null,
  p_technician_id uuid default null, p_date_from date default null,
  p_date_to date default null, p_page integer default 1, p_page_size integer default 10
)
returns jsonb language plpgsql stable security invoker
set search_path = public, pg_temp
as $$
declare
  v_search text := public.normalize_document_search(p_search);
  v_number numeric := substring(btrim(p_search) from '^[+-]?[0-9]+')::numeric;
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_company_member(auth.uid(), p_company_id)
    or not public.has_company_permission(auth.uid(), p_company_id, 'documents.view')
    or not exists (select 1 from public.companies where id = p_company_id and status = 'ACTIVE') then
    raise exception 'Sin permiso para consultar documentos de esta empresa' using errcode = '42501';
  end if;
  if p_page is null or p_page < 1 or p_page_size is null or p_page_size not between 1 and 200
    or (p_date_from is not null and p_date_to is not null and p_date_from > p_date_to) then
    raise exception 'Pagina, cantidad o rango de fechas invalido' using errcode = '22023';
  end if;

  with filtered as not materialized (
    select d.* from public.documents d
    where d.company_id = p_company_id
      and (p_type = 'ALL' or d.doc_type::text = p_type)
      and (p_status = 'ALL' or d.status::text = p_status)
      and (p_customer_id is null or d.customer_id = p_customer_id)
      and (p_technician_id is null or d.technician_id = p_technician_id)
      and (p_date_from is null or d.issue_date >= p_date_from)
      and (p_date_to is null or d.issue_date <= p_date_to)
      and (v_search = '' or strpos(public.normalize_document_search(concat_ws(' ',
        nullif(d.customer_name, ''), nullif(d.customer_tax_id, ''), nullif(d.external_invoice_number, ''),
        nullif(d.salesperson, ''), nullif(d.payment_terms, ''), nullif(d.delivery_address, ''),
        nullif(d.notes, ''), nullif(d.source_document_number_snapshot, ''),
        d.doc_type::text, d.status::text, d.document_number::text)), v_search) > 0
        or d.document_number = v_number)
  ), totals as (select count(*) as total from filtered), paging as (
    select total, least(p_page::bigint, greatest(1::bigint, (total + p_page_size - 1) / p_page_size)) as page
    from totals
  )
  select jsonb_build_object('total', paging.total, 'page', paging.page,
    'rows', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc, r.id desc)
      from (select * from filtered order by created_at desc, id desc
        limit p_page_size offset ((paging.page - 1) * p_page_size)) r), '[]'::jsonb))
  into v_result from paging;
  return v_result;
end;
$$;

-- Only inspect cash usage for the visible page and the independently opened document.
create function public.documents_page_cash_usage(p_company_id uuid, p_document_ids uuid[])
returns table(document_id uuid) language plpgsql stable security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_company_member(auth.uid(), p_company_id)
    or not public.has_company_permission(auth.uid(), p_company_id, 'documents.view')
    or not exists (select 1 from public.companies where id = p_company_id and status = 'ACTIVE') then
    raise exception 'Sin permiso para consultar documentos de esta empresa' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_document_ids), 0) > 201 then
    raise exception 'Demasiados documentos solicitados' using errcode = '22023';
  end if;
  return query select d.id from public.documents d
    where d.company_id = p_company_id and d.id = any(p_document_ids)
      and exists (select 1 from public.cash_sales c where c.company_id = p_company_id
        and c.status <> 'ANULADA' and (c.document_id = d.id
          or (c.receipt_kind = 'FACTURA' and nullif(btrim(d.external_invoice_number), '') is not null
            and btrim(c.receipt_reference) = btrim(d.external_invoice_number))));
end;
$$;

revoke all on function public.normalize_document_search(text) from public, anon;
revoke all on function public.list_documents_page(uuid,text,text,text,uuid,uuid,date,date,integer,integer) from public, anon;
revoke all on function public.documents_page_cash_usage(uuid,uuid[]) from public, anon;
grant execute on function public.normalize_document_search(text) to authenticated;
grant execute on function public.list_documents_page(uuid,text,text,text,uuid,uuid,date,date,integer,integer) to authenticated;
grant execute on function public.documents_page_cash_usage(uuid,uuid[]) to authenticated;
commit;
