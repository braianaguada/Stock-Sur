create table if not exists public.document_share_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  token text not null unique,
  enabled boolean not null default true,
  expires_at timestamptz null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  last_accessed_at timestamptz null
);

create index if not exists document_share_links_document_idx
  on public.document_share_links(document_id, created_at desc);

alter table public.document_share_links enable row level security;

create policy "document_share_links_company_read"
on public.document_share_links for select to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'documents.print')
);

create or replace function public.create_document_share_link(
  p_document_id uuid,
  p_expires_at timestamptz default null
)
returns public.document_share_links
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_doc public.documents%rowtype;
  v_link public.document_share_links%rowtype;
begin
  if v_actor is null then raise exception 'Debes iniciar sesion para compartir documentos'; end if;

  select * into v_doc from public.documents where id = p_document_id;
  if not found or v_doc.doc_type::text not in ('PRESUPUESTO', 'REMITO') then
    raise exception 'Documento no encontrado o no compartible';
  end if;
  if not public.is_company_member(v_actor, v_doc.company_id)
     or not public.has_company_permission(v_actor, v_doc.company_id, 'documents.print') then
    raise exception 'No tienes permisos para compartir este documento';
  end if;

  select * into v_link
  from public.document_share_links
  where document_id = p_document_id and enabled
    and (expires_at is null or expires_at > now())
  order by created_at desc limit 1;
  if found then return v_link; end if;

  insert into public.document_share_links(company_id, document_id, token, expires_at, created_by)
  values (v_doc.company_id, v_doc.id, encode(gen_random_bytes(32), 'hex'), p_expires_at, v_actor)
  returning * into v_link;
  return v_link;
end;
$$;

grant execute on function public.create_document_share_link(uuid, timestamptz) to authenticated;

create or replace function public.revoke_document_share_link(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_link public.document_share_links%rowtype;
begin
  if v_actor is null then raise exception 'Debes iniciar sesion para revocar links'; end if;
  select * into v_link from public.document_share_links where token = p_token;
  if not found then raise exception 'Link no encontrado'; end if;
  if not public.is_company_member(v_actor, v_link.company_id)
     or not public.has_company_permission(v_actor, v_link.company_id, 'documents.print') then
    raise exception 'No tienes permisos para revocar este link';
  end if;
  update public.document_share_links set enabled = false where id = v_link.id;
end;
$$;

grant execute on function public.revoke_document_share_link(text) to authenticated;

create or replace function public.get_public_document_payload(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.document_share_links%rowtype;
  v_payload jsonb;
begin
  select * into v_link from public.document_share_links where token = p_token;
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if not v_link.enabled then return jsonb_build_object('status', 'revoked'); end if;
  if v_link.expires_at is not null and v_link.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;

  update public.document_share_links set last_accessed_at = now() where id = v_link.id;

  select jsonb_build_object(
    'status', 'ok',
    'document', to_jsonb(d)
      - 'id'
      - 'company_id'
      - 'customer_id'
      - 'technician_id'
      - 'service_id'
      - 'origin_document_id'
      - 'price_list_id'
      - 'source_document_id'
      - 'created_by'
      - 'updated_at',
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'line_order', l.line_order,
        'sku_snapshot', l.sku_snapshot,
        'description', l.description,
        'quantity', l.quantity,
        'unit', l.unit,
        'unit_price', l.unit_price,
        'line_total', l.line_total
      ) order by l.line_order)
      from public.document_lines l where l.document_id = d.id
    ), '[]'::jsonb),
    'technician_name', t.name,
    'company', jsonb_build_object(
      'app_name', cs.app_name, 'legal_name', cs.legal_name, 'tax_id', cs.tax_id,
      'address', cs.address, 'phone', cs.phone, 'email', cs.email,
      'logo_url', cs.logo_url, 'document_tagline', cs.document_tagline,
      'document_footer', cs.document_footer
    )
  ) into v_payload
  from public.documents d
  left join public.technicians t on t.id = d.technician_id and t.company_id = d.company_id
  left join public.company_settings cs on cs.company_id = d.company_id
  where d.id = v_link.document_id and d.company_id = v_link.company_id;

  return coalesce(v_payload, jsonb_build_object('status', 'not_found'));
end;
$$;

grant execute on function public.get_public_document_payload(text) to anon, authenticated;
