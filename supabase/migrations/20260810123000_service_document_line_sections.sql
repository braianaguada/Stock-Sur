alter table public.service_document_lines
  add column if not exists line_type text not null default 'ITEM'
  check (line_type in ('ITEM', 'TITLE', 'SUBTITLE'));

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
  p_hide_line_prices boolean default false
)
returns public.service_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.service_documents%rowtype;
begin
  v_doc := public.save_service_document(
    p_document_id, p_company_id, p_customer_id, p_status, p_reference,
    p_issue_date, p_valid_until, p_delivery_time, p_payment_terms,
    p_delivery_location, p_intro_text, p_closing_text, p_currency, p_lines,
    p_exchange_rate_source, p_exchange_rate, p_exchange_rate_date,
    p_exchange_rate_fetched_at, p_exchange_rate_snapshot_label,
    p_show_exchange_rate_note, p_pricing_mode, p_global_total, p_hide_line_prices
  );

  update public.service_document_lines line
  set line_type = source.line_type
  from (
    select ord::integer as sort_order,
      case upper(coalesce(value->>'line_type', 'ITEM'))
        when 'TITLE' then 'TITLE' when 'SUBTITLE' then 'SUBTITLE' else 'ITEM'
      end as line_type
    from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) with ordinality input(value, ord)
    where trim(coalesce(value->>'description', '')) <> ''
  ) source
  where line.document_id = v_doc.id and line.sort_order = source.sort_order;

  return v_doc;
end;
$$;

revoke all on function public.save_service_document_with_sections(uuid, uuid, uuid, public.service_document_status, text, date, date, text, text, text, text, text, text, jsonb, text, numeric, date, timestamptz, text, boolean, text, numeric, boolean) from public;
grant execute on function public.save_service_document_with_sections(uuid, uuid, uuid, public.service_document_status, text, date, date, text, text, text, text, text, text, jsonb, text, numeric, date, timestamptz, text, boolean, text, numeric, boolean) to authenticated;

create or replace function public.create_service_document_copy_with_sections(p_source_document_id uuid, p_target_type public.service_document_type)
returns public.service_documents
language plpgsql
security definer
set search_path = public
as $$
declare v_doc public.service_documents%rowtype;
begin
  v_doc := public.create_service_document_copy(p_source_document_id, p_target_type);
  update public.service_document_lines target
  set line_type = source.line_type
  from public.service_document_lines source
  where source.document_id = p_source_document_id
    and target.document_id = v_doc.id
    and target.sort_order = source.sort_order;
  return v_doc;
end;
$$;
revoke all on function public.create_service_document_copy_with_sections(uuid, public.service_document_type) from public;
grant execute on function public.create_service_document_copy_with_sections(uuid, public.service_document_type) to authenticated;
notify pgrst, 'reload schema';
