alter table public.service_documents
  add column if not exists exchange_rate_source text null default 'BNA',
  add column if not exists exchange_rate numeric(14,4) null,
  add column if not exists exchange_rate_date date null,
  add column if not exists exchange_rate_fetched_at timestamptz null,
  add column if not exists exchange_rate_snapshot_label text null,
  add column if not exists show_exchange_rate_note boolean not null default true,
  add column if not exists pricing_mode text not null default 'DETAILED',
  add column if not exists global_total numeric(14,2) null,
  add column if not exists hide_line_prices boolean not null default false;

alter table public.service_documents
  drop constraint if exists service_documents_currency_check,
  add constraint service_documents_currency_check check (currency in ('ARS', 'USD'));

alter table public.service_documents
  drop constraint if exists service_documents_pricing_mode_check,
  add constraint service_documents_pricing_mode_check check (pricing_mode in ('DETAILED', 'GLOBAL_TOTAL'));

alter table public.service_documents
  drop constraint if exists service_documents_global_total_check,
  add constraint service_documents_global_total_check check (global_total is null or global_total >= 0);

create table if not exists public.service_document_attachments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  service_document_id uuid not null references public.service_documents(id) on delete cascade,
  storage_bucket text not null default 'service-document-attachments',
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  title text null,
  description text null,
  sort_order integer not null default 1,
  include_in_print boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_document_attachments_mime_check check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint service_document_attachments_size_check check (size_bytes > 0 and size_bytes <= 10485760),
  constraint service_document_attachments_sort_check check (sort_order > 0),
  constraint service_document_attachments_bucket_check check (storage_bucket = 'service-document-attachments')
);

create index if not exists service_document_attachments_document_idx
  on public.service_document_attachments(service_document_id, sort_order, created_at);

create unique index if not exists service_document_attachments_storage_path_key
  on public.service_document_attachments(storage_bucket, storage_path);

drop trigger if exists update_service_document_attachments_updated_at on public.service_document_attachments;
create trigger update_service_document_attachments_updated_at
before update on public.service_document_attachments
for each row execute function public.update_updated_at_column();

create table if not exists public.service_document_share_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  service_document_id uuid not null references public.service_documents(id) on delete cascade,
  token text not null,
  enabled boolean not null default true,
  expires_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz null,
  constraint service_document_share_links_token_len check (length(token) >= 48)
);

create unique index if not exists service_document_share_links_token_key
  on public.service_document_share_links(token);

create unique index if not exists service_document_share_links_one_active_doc
  on public.service_document_share_links(service_document_id)
  where enabled;

create index if not exists service_document_share_links_document_idx
  on public.service_document_share_links(service_document_id, enabled, expires_at);

insert into storage.buckets (id, name, public)
values ('service-document-attachments', 'service-document-attachments', false)
on conflict (id) do update set public = false;

alter table public.service_document_attachments enable row level security;
alter table public.service_document_share_links enable row level security;

drop policy if exists "service_document_attachments_read_company_member" on public.service_document_attachments;
drop policy if exists "service_document_attachments_insert_company_member" on public.service_document_attachments;
drop policy if exists "service_document_attachments_update_company_member" on public.service_document_attachments;
drop policy if exists "service_document_attachments_delete_company_member" on public.service_document_attachments;
drop policy if exists "service_document_share_links_read_company_member" on public.service_document_share_links;
drop policy if exists "service_document_share_links_insert_company_member" on public.service_document_share_links;
drop policy if exists "service_document_share_links_update_company_member" on public.service_document_share_links;

create policy "service_document_attachments_read_company_member"
on public.service_document_attachments
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'documents.view')
);

create policy "service_document_attachments_insert_company_member"
on public.service_document_attachments
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.service_documents d
    where d.id = service_document_id
      and d.company_id = service_document_attachments.company_id
      and d.status = 'DRAFT'
      and public.is_company_member(auth.uid(), d.company_id)
      and public.has_company_permission(auth.uid(), d.company_id, 'documents.edit')
  )
);

create policy "service_document_attachments_update_company_member"
on public.service_document_attachments
for update
to authenticated
using (
  exists (
    select 1
    from public.service_documents d
    where d.id = service_document_id
      and d.status = 'DRAFT'
      and public.is_company_member(auth.uid(), d.company_id)
      and public.has_company_permission(auth.uid(), d.company_id, 'documents.edit')
  )
)
with check (
  exists (
    select 1
    from public.service_documents d
    where d.id = service_document_id
      and d.company_id = service_document_attachments.company_id
      and d.status = 'DRAFT'
      and public.is_company_member(auth.uid(), d.company_id)
      and public.has_company_permission(auth.uid(), d.company_id, 'documents.edit')
  )
);

create policy "service_document_attachments_delete_company_member"
on public.service_document_attachments
for delete
to authenticated
using (
  exists (
    select 1
    from public.service_documents d
    where d.id = service_document_id
      and d.status = 'DRAFT'
      and public.is_company_member(auth.uid(), d.company_id)
      and public.has_company_permission(auth.uid(), d.company_id, 'documents.edit')
  )
);

create policy "service_document_share_links_read_company_member"
on public.service_document_share_links
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'documents.view')
);

create policy "service_document_share_links_insert_company_member"
on public.service_document_share_links
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'documents.print')
);

create policy "service_document_share_links_update_company_member"
on public.service_document_share_links
for update
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'documents.print')
)
with check (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'documents.print')
);

drop policy if exists "service_document_attachment_storage_member_read" on storage.objects;
drop policy if exists "service_document_attachment_storage_member_insert" on storage.objects;
drop policy if exists "service_document_attachment_storage_member_update" on storage.objects;
drop policy if exists "service_document_attachment_storage_member_delete" on storage.objects;
drop policy if exists "service_document_attachment_storage_public_shared_read" on storage.objects;

create policy "service_document_attachment_storage_member_read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'service-document-attachments'
  and exists (
    select 1
    from public.service_document_attachments a
    where a.storage_bucket = bucket_id
      and a.storage_path = name
      and public.is_company_member(auth.uid(), a.company_id)
      and public.has_company_permission(auth.uid(), a.company_id, 'documents.view')
  )
);

create policy "service_document_attachment_storage_member_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'service-document-attachments'
  and public.is_company_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  and public.has_company_permission(auth.uid(), (storage.foldername(name))[1]::uuid, 'documents.edit')
);

create policy "service_document_attachment_storage_member_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'service-document-attachments'
  and public.is_company_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  and public.has_company_permission(auth.uid(), (storage.foldername(name))[1]::uuid, 'documents.edit')
)
with check (
  bucket_id = 'service-document-attachments'
  and public.is_company_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  and public.has_company_permission(auth.uid(), (storage.foldername(name))[1]::uuid, 'documents.edit')
);

create policy "service_document_attachment_storage_member_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'service-document-attachments'
  and public.is_company_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  and public.has_company_permission(auth.uid(), (storage.foldername(name))[1]::uuid, 'documents.edit')
);

create policy "service_document_attachment_storage_public_shared_read"
on storage.objects
for select
to anon
using (
  bucket_id = 'service-document-attachments'
  and exists (
    select 1
    from public.service_document_attachments a
    join public.service_document_share_links s on s.service_document_id = a.service_document_id
    where a.storage_bucket = bucket_id
      and a.storage_path = name
      and a.include_in_print
      and s.enabled
      and (s.expires_at is null or s.expires_at > now())
  )
);

drop function if exists public.save_service_document(
  uuid,
  uuid,
  uuid,
  public.service_document_status,
  text,
  date,
  date,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
);

create or replace function public.save_service_document(
  p_document_id uuid,
  p_company_id uuid,
  p_customer_id uuid,
  p_status public.service_document_status,
  p_reference text,
  p_issue_date date,
  p_valid_until date,
  p_delivery_time text,
  p_payment_terms text,
  p_delivery_location text,
  p_intro_text text,
  p_closing_text text,
  p_currency text,
  p_lines jsonb,
  p_exchange_rate_source text default null,
  p_exchange_rate numeric default null,
  p_exchange_rate_date date default null,
  p_exchange_rate_fetched_at timestamptz default null,
  p_exchange_rate_snapshot_label text default null,
  p_show_exchange_rate_note boolean default true,
  p_pricing_mode text default 'DETAILED',
  p_global_total numeric default null,
  p_hide_line_prices boolean default false
)
returns public.service_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_doc public.service_documents%rowtype;
  v_total numeric(14,2) := 0;
  v_pricing_mode text := coalesce(p_pricing_mode, 'DETAILED');
  v_currency text := coalesce(p_currency, 'ARS');
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para guardar documentos de servicio';
  end if;

  if v_currency not in ('ARS', 'USD') then
    raise exception 'Moneda invalida';
  end if;

  if v_pricing_mode not in ('DETAILED', 'GLOBAL_TOTAL') then
    raise exception 'Modo de precio invalido';
  end if;

  if v_pricing_mode = 'GLOBAL_TOTAL' and coalesce(p_global_total, -1) < 0 then
    raise exception 'El precio final global debe ser mayor o igual a cero';
  end if;

  if p_document_id is null then
    if not public.is_company_member(v_actor, p_company_id)
       or not public.has_company_permission(v_actor, p_company_id, 'documents.create') then
      raise exception 'No tienes permisos para crear documentos de servicio';
    end if;

    insert into public.service_documents (
      company_id,
      customer_id,
      type,
      status,
      reference,
      issue_date,
      valid_until,
      delivery_time,
      payment_terms,
      delivery_location,
      intro_text,
      closing_text,
      subtotal,
      total,
      currency,
      exchange_rate_source,
      exchange_rate,
      exchange_rate_date,
      exchange_rate_fetched_at,
      exchange_rate_snapshot_label,
      show_exchange_rate_note,
      pricing_mode,
      global_total,
      hide_line_prices,
      created_by
    ) values (
      p_company_id,
      p_customer_id,
      'QUOTE',
      p_status,
      p_reference,
      p_issue_date,
      p_valid_until,
      p_delivery_time,
      p_payment_terms,
      p_delivery_location,
      p_intro_text,
      p_closing_text,
      0,
      0,
      v_currency,
      case when v_currency = 'USD' then coalesce(p_exchange_rate_source, 'BNA') else null end,
      case when v_currency = 'USD' then p_exchange_rate else null end,
      case when v_currency = 'USD' then p_exchange_rate_date else null end,
      case when v_currency = 'USD' then p_exchange_rate_fetched_at else null end,
      case when v_currency = 'USD' then p_exchange_rate_snapshot_label else null end,
      coalesce(p_show_exchange_rate_note, true),
      v_pricing_mode,
      case when v_pricing_mode = 'GLOBAL_TOTAL' then p_global_total else null end,
      coalesce(p_hide_line_prices, v_pricing_mode = 'GLOBAL_TOTAL'),
      v_actor
    )
    returning * into v_doc;
  else
    if not exists (
      select 1
      from public.service_documents d
      where d.id = p_document_id
        and d.company_id = p_company_id
        and public.is_company_member(v_actor, d.company_id)
        and public.has_company_permission(v_actor, d.company_id, 'documents.edit')
    ) then
      raise exception 'No tienes permisos para editar documentos de servicio';
    end if;

    update public.service_documents
    set
      customer_id = p_customer_id,
      status = p_status,
      reference = p_reference,
      issue_date = p_issue_date,
      valid_until = p_valid_until,
      delivery_time = p_delivery_time,
      payment_terms = p_payment_terms,
      delivery_location = p_delivery_location,
      intro_text = p_intro_text,
      closing_text = p_closing_text,
      currency = v_currency,
      exchange_rate_source = case when v_currency = 'USD' then coalesce(p_exchange_rate_source, exchange_rate_source, 'BNA') else null end,
      exchange_rate = case when v_currency = 'USD' then p_exchange_rate else null end,
      exchange_rate_date = case when v_currency = 'USD' then p_exchange_rate_date else null end,
      exchange_rate_fetched_at = case when v_currency = 'USD' then p_exchange_rate_fetched_at else null end,
      exchange_rate_snapshot_label = case when v_currency = 'USD' then p_exchange_rate_snapshot_label else null end,
      show_exchange_rate_note = coalesce(p_show_exchange_rate_note, true),
      pricing_mode = v_pricing_mode,
      global_total = case when v_pricing_mode = 'GLOBAL_TOTAL' then p_global_total else null end,
      hide_line_prices = coalesce(p_hide_line_prices, v_pricing_mode = 'GLOBAL_TOTAL'),
      updated_at = now()
    where id = p_document_id
      and status = 'DRAFT'
    returning * into v_doc;

    if not found then
      raise exception 'Documento de servicio no encontrado o no editable';
    end if;

    delete from public.service_document_lines where document_id = v_doc.id;
  end if;

  insert into public.service_document_lines (
    document_id,
    description,
    quantity,
    unit,
    unit_price,
    line_total,
    sort_order
  )
  select
    v_doc.id,
    trim(coalesce(line_item.value->>'description', '')),
    nullif(line_item.value->>'quantity', '')::numeric,
    nullif(line_item.value->>'unit', ''),
    case when v_pricing_mode = 'GLOBAL_TOTAL' then null else nullif(line_item.value->>'unit_price', '')::numeric end,
    case when v_pricing_mode = 'GLOBAL_TOTAL' then 0 else coalesce(nullif(line_item.value->>'line_total', '')::numeric, 0) end,
    line_item.ord::integer
  from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) with ordinality as line_item(value, ord)
  where trim(coalesce(line_item.value->>'description', '')) <> ''
  order by line_item.ord;

  if v_pricing_mode = 'GLOBAL_TOTAL' then
    v_total := coalesce(p_global_total, 0);
  else
    select coalesce(sum(line_total), 0)
    into v_total
    from public.service_document_lines
    where document_id = v_doc.id;
  end if;

  update public.service_documents
  set subtotal = v_total,
      total = v_total
  where id = v_doc.id
  returning * into v_doc;

  return v_doc;
end;
$$;

grant execute on function public.save_service_document(
  uuid,
  uuid,
  uuid,
  public.service_document_status,
  text,
  date,
  date,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  text,
  numeric,
  date,
  timestamptz,
  text,
  boolean,
  text,
  numeric,
  boolean
) to authenticated;

create or replace function public.create_service_document_share_link(
  p_service_document_id uuid,
  p_expires_at timestamptz default null
)
returns public.service_document_share_links
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_doc public.service_documents%rowtype;
  v_link public.service_document_share_links%rowtype;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para compartir presupuestos';
  end if;

  select *
  into v_doc
  from public.service_documents
  where id = p_service_document_id;

  if not found then
    raise exception 'Presupuesto no encontrado';
  end if;

  if not public.is_company_member(v_actor, v_doc.company_id)
     or not public.has_company_permission(v_actor, v_doc.company_id, 'documents.print') then
    raise exception 'No tienes permisos para compartir este presupuesto';
  end if;

  select *
  into v_link
  from public.service_document_share_links
  where service_document_id = p_service_document_id
    and enabled
    and (expires_at is null or expires_at > now())
  order by created_at desc
  limit 1;

  if found then
    return v_link;
  end if;

  insert into public.service_document_share_links (
    company_id,
    service_document_id,
    token,
    expires_at,
    created_by
  ) values (
    v_doc.company_id,
    v_doc.id,
    encode(gen_random_bytes(32), 'hex'),
    p_expires_at,
    v_actor
  )
  returning * into v_link;

  return v_link;
end;
$$;

grant execute on function public.create_service_document_share_link(uuid, timestamptz) to authenticated;

create or replace function public.revoke_service_document_share_link(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_link public.service_document_share_links%rowtype;
begin
  if v_actor is null then
    raise exception 'Debes iniciar sesion para revocar links';
  end if;

  select *
  into v_link
  from public.service_document_share_links
  where token = p_token;

  if not found then
    raise exception 'Link no encontrado';
  end if;

  if not public.is_company_member(v_actor, v_link.company_id)
     or not public.has_company_permission(v_actor, v_link.company_id, 'documents.print') then
    raise exception 'No tienes permisos para revocar este link';
  end if;

  update public.service_document_share_links
  set enabled = false
  where id = v_link.id;
end;
$$;

grant execute on function public.revoke_service_document_share_link(text) to authenticated;

create or replace function public.get_public_service_document_payload(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.service_document_share_links%rowtype;
  v_payload jsonb;
begin
  select *
  into v_link
  from public.service_document_share_links
  where token = p_token;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if not v_link.enabled then
    return jsonb_build_object('status', 'revoked');
  end if;

  if v_link.expires_at is not null and v_link.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;

  update public.service_document_share_links
  set last_accessed_at = now()
  where id = v_link.id;

  select jsonb_build_object(
    'status', 'ok',
    'document', to_jsonb(d) - 'created_by' - 'company_id',
    'customer', case when c.id is null then null else jsonb_build_object(
      'name', c.name,
      'cuit', c.cuit,
      'email', c.email,
      'phone', c.phone
    ) end,
    'lines', coalesce((
      select jsonb_agg(to_jsonb(l) - 'document_id' order by l.sort_order)
      from public.service_document_lines l
      where l.document_id = d.id
    ), '[]'::jsonb),
    'attachments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'storage_bucket', a.storage_bucket,
        'storage_path', a.storage_path,
        'file_name', a.file_name,
        'mime_type', a.mime_type,
        'title', a.title,
        'description', a.description,
        'sort_order', a.sort_order
      ) order by a.sort_order, a.created_at)
      from public.service_document_attachments a
      where a.service_document_id = d.id
        and a.include_in_print
    ), '[]'::jsonb),
    'company', jsonb_build_object(
      'app_name', cs.app_name,
      'legal_name', cs.legal_name,
      'tax_id', cs.tax_id,
      'address', cs.address,
      'phone', cs.phone,
      'email', cs.email,
      'logo_url', cs.logo_url,
      'document_tagline', cs.document_tagline,
      'document_footer', cs.document_footer
    )
  )
  into v_payload
  from public.service_documents d
  left join public.customers c on c.id = d.customer_id
  left join public.company_settings cs on cs.company_id = d.company_id
  where d.id = v_link.service_document_id;

  return coalesce(v_payload, jsonb_build_object('status', 'not_found'));
end;
$$;

grant execute on function public.get_public_service_document_payload(text) to anon, authenticated;
