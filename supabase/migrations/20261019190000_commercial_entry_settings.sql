begin;

update public.roles set name = 'Vendedor' where code = 'operador' and scope = 'COMPANY';

create or replace function public.list_document_salespeople(p_company_id uuid)
returns table(id uuid, name text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_company_operable(p_company_id)
     or not public.has_company_permission(auth.uid(), p_company_id, 'documents.view')
     or (not public.is_superadmin(auth.uid()) and not exists (
       select 1 from public.company_users cu where cu.company_id = p_company_id
       and cu.user_id = auth.uid() and cu.status = 'ACTIVE'
     )) then
    raise exception 'No tienes permiso para consultar vendedores de esta empresa';
  end if;
  return query
  select p.user_id, coalesce(nullif(trim(p.full_name), ''), 'Vendedor')
  from public.profiles p
  where (p.user_id = auth.uid() and public.is_superadmin(auth.uid()))
     or exists (
       select 1 from public.company_users cu
       where cu.company_id = p_company_id and cu.user_id = p.user_id and cu.status = 'ACTIVE'
       and (public.is_superadmin(p.user_id) or (
         exists (select 1 from public.company_user_roles ur join public.roles r on r.id = ur.role_id
           where ur.company_user_id = cu.id and r.code = 'operador' and r.scope = 'COMPANY')
         and not exists (select 1 from public.company_user_roles ur join public.roles r on r.id = ur.role_id
           where ur.company_user_id = cu.id and r.code = 'admin' and r.scope = 'COMPANY')
       ))
     )
  order by 2, 1;
end;
$$;
revoke all on function public.list_document_salespeople(uuid) from public;
grant execute on function public.list_document_salespeople(uuid) to authenticated;

create or replace function public.save_service_document_with_sections(
  p_document_id uuid, p_company_id uuid, p_customer_id uuid,
  p_status public.service_document_status, p_reference text, p_issue_date date,
  p_valid_until date, p_delivery_time text, p_payment_terms text,
  p_delivery_location text, p_intro_text text, p_closing_text text,
  p_currency text, p_lines jsonb,
  p_exchange_rate_source text default null, p_exchange_rate numeric default null,
  p_exchange_rate_date date default null, p_exchange_rate_fetched_at timestamptz default null,
  p_exchange_rate_snapshot_label text default null, p_show_exchange_rate_note boolean default true,
  p_pricing_mode text default 'DETAILED', p_global_total numeric default null,
  p_hide_line_prices boolean default false, p_include_tax boolean default false,
  p_tax_rate numeric default 21
)
returns public.service_documents
language plpgsql security definer set search_path = public
as $$
declare v_doc public.service_documents%rowtype; v_rate numeric;
begin
  v_rate := case when p_include_tax then greatest(0, least(coalesce(p_tax_rate, 21), 100)) else 0 end;
  v_doc := public.save_service_document(
    p_document_id, p_company_id, p_customer_id, case when p_status = 'SENT' then 'DRAFT'::public.service_document_status else p_status end, p_reference,
    p_issue_date, p_valid_until, p_delivery_time, p_payment_terms,
    p_delivery_location, p_intro_text, p_closing_text, p_currency, p_lines,
    p_exchange_rate_source, p_exchange_rate, p_exchange_rate_date,
    p_exchange_rate_fetched_at, p_exchange_rate_snapshot_label,
    p_show_exchange_rate_note, p_pricing_mode, p_global_total, p_hide_line_prices
  );

  update public.service_documents
  set include_tax = p_include_tax,
      tax_rate = coalesce(p_tax_rate, 21),
      tax_total = case when p_include_tax then round(subtotal * v_rate / 100, 2) else 0 end,
      total = subtotal + case when p_include_tax then round(subtotal * v_rate / 100, 2) else 0 end
  where id = v_doc.id
  returning * into v_doc;

  update public.service_document_lines line
  set line_type = source.line_type,
      is_bold = source.is_bold,
      is_underlined = source.is_underlined
  from (
    select ord::integer as sort_order,
      case upper(coalesce(value->>'line_type', 'ITEM'))
        when 'TITLE' then 'TITLE' when 'SUBTITLE' then 'SUBTITLE' else 'ITEM'
      end as line_type,
      coalesce((value->>'is_bold')::boolean, false) as is_bold,
      coalesce((value->>'is_underlined')::boolean, false) as is_underlined
    from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) with ordinality input(value, ord)
    where trim(coalesce(value->>'description', '')) <> ''
  ) source
  where line.document_id = v_doc.id and line.sort_order = source.sort_order;
  if p_status = 'SENT' then
    v_doc := public.transition_service_document_status(v_doc.id, 'SENT');
  end if;
  return v_doc;
end;
$$;

revoke all on function public.save_service_document_with_sections(uuid, uuid, uuid, public.service_document_status, text, date, date, text, text, text, text, text, text, jsonb, text, numeric, date, timestamptz, text, boolean, text, numeric, boolean, boolean, numeric) from public;
grant execute on function public.save_service_document_with_sections(uuid, uuid, uuid, public.service_document_status, text, date, date, text, text, text, text, text, text, jsonb, text, numeric, date, timestamptz, text, boolean, text, numeric, boolean, boolean, numeric) to authenticated;


notify pgrst, 'reload schema';
commit;
