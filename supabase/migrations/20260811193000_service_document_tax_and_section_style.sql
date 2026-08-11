alter table public.service_documents
  add column if not exists include_tax boolean not null default false,
  add column if not exists tax_rate numeric(8,4) not null default 21,
  add column if not exists tax_total numeric(14,2) not null default 0;

alter table public.service_documents
  drop constraint if exists service_documents_tax_values_check;
alter table public.service_documents
  add constraint service_documents_tax_values_check
  check (tax_rate >= 0 and tax_rate <= 100 and tax_total >= 0);

alter table public.service_document_lines
  add column if not exists is_bold boolean not null default false,
  add column if not exists is_underlined boolean not null default false;

update public.service_document_lines set is_bold = true where line_type = 'TITLE';

drop function if exists public.save_service_document_with_sections(uuid, uuid, uuid, public.service_document_status, text, date, date, text, text, text, text, text, text, jsonb, text, numeric, date, timestamptz, text, boolean, text, numeric, boolean);

create function public.save_service_document_with_sections(
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
    p_document_id, p_company_id, p_customer_id, p_status, p_reference,
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
  return v_doc;
end;
$$;

revoke all on function public.save_service_document_with_sections(uuid, uuid, uuid, public.service_document_status, text, date, date, text, text, text, text, text, text, jsonb, text, numeric, date, timestamptz, text, boolean, text, numeric, boolean, boolean, numeric) from public;
grant execute on function public.save_service_document_with_sections(uuid, uuid, uuid, public.service_document_status, text, date, date, text, text, text, text, text, text, jsonb, text, numeric, date, timestamptz, text, boolean, text, numeric, boolean, boolean, numeric) to authenticated;

create or replace function public.create_service_document_copy_with_sections(p_source_document_id uuid, p_target_type public.service_document_type)
returns public.service_documents language plpgsql security definer set search_path = public
as $$
declare v_doc public.service_documents%rowtype;
begin
  v_doc := public.create_service_document_copy(p_source_document_id, p_target_type);
  update public.service_documents target
  set include_tax = source.include_tax, tax_rate = source.tax_rate, tax_total = source.tax_total,
      subtotal = source.subtotal, total = source.total
  from public.service_documents source
  where source.id = p_source_document_id and target.id = v_doc.id
  returning target.* into v_doc;
  update public.service_document_lines target
  set line_type = source.line_type, is_bold = source.is_bold, is_underlined = source.is_underlined
  from public.service_document_lines source
  where source.document_id = p_source_document_id and target.document_id = v_doc.id and target.sort_order = source.sort_order;
  return v_doc;
end;
$$;

notify pgrst, 'reload schema';
