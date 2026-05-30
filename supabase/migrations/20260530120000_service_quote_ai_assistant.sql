create table if not exists public.service_quote_ai_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  default_currency text not null default 'ARS',
  technician_hour_rate numeric(14,2) null,
  minimum_visit_price numeric(14,2) null,
  travel_base_price numeric(14,2) null,
  default_margin_percent numeric(7,2) null,
  urgency_markup_percent numeric(7,2) null,
  complexity_low_multiplier numeric(8,4) not null default 0.85,
  complexity_medium_multiplier numeric(8,4) not null default 1,
  complexity_high_multiplier numeric(8,4) not null default 1.25,
  warranty_note text null,
  commercial_terms text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_quote_ai_settings_company_unique unique (company_id),
  constraint service_quote_ai_settings_currency_check check (default_currency in ('ARS', 'USD')),
  constraint service_quote_ai_settings_non_negative_check check (
    coalesce(technician_hour_rate, 0) >= 0
    and coalesce(minimum_visit_price, 0) >= 0
    and coalesce(travel_base_price, 0) >= 0
    and coalesce(default_margin_percent, 0) >= 0
    and coalesce(urgency_markup_percent, 0) >= 0
  )
);

create table if not exists public.service_document_ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  service_document_id uuid null references public.service_documents(id) on delete set null,
  input_snapshot jsonb not null,
  output_snapshot jsonb not null,
  suggested_min_total numeric(14,2) null,
  suggested_recommended_total numeric(14,2) null,
  suggested_max_total numeric(14,2) null,
  confidence text null,
  accepted boolean not null default false,
  accepted_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint service_document_ai_suggestions_confidence_check check (
    confidence is null or confidence in ('LOW', 'MEDIUM', 'HIGH')
  ),
  constraint service_document_ai_suggestions_totals_check check (
    (suggested_min_total is null or suggested_min_total >= 0)
    and (suggested_recommended_total is null or suggested_recommended_total >= 0)
    and (suggested_max_total is null or suggested_max_total >= 0)
  )
);

create index if not exists service_document_ai_suggestions_company_created_idx
  on public.service_document_ai_suggestions(company_id, created_at desc);

create index if not exists service_document_ai_suggestions_document_idx
  on public.service_document_ai_suggestions(service_document_id);

drop trigger if exists update_service_quote_ai_settings_updated_at on public.service_quote_ai_settings;
create trigger update_service_quote_ai_settings_updated_at
before update on public.service_quote_ai_settings
for each row execute function public.update_updated_at_column();

alter table public.service_quote_ai_settings enable row level security;
alter table public.service_document_ai_suggestions enable row level security;

drop policy if exists "service_quote_ai_settings_read_company_member" on public.service_quote_ai_settings;
drop policy if exists "service_quote_ai_settings_insert_company_admin" on public.service_quote_ai_settings;
drop policy if exists "service_quote_ai_settings_update_company_admin" on public.service_quote_ai_settings;
drop policy if exists "service_document_ai_suggestions_read_company_member" on public.service_document_ai_suggestions;
drop policy if exists "service_document_ai_suggestions_insert_company_member" on public.service_document_ai_suggestions;
drop policy if exists "service_document_ai_suggestions_update_company_member" on public.service_document_ai_suggestions;

create policy "service_quote_ai_settings_read_company_member"
on public.service_quote_ai_settings
for select
to authenticated
using (public.is_company_member(auth.uid(), company_id));

create policy "service_quote_ai_settings_insert_company_admin"
on public.service_quote_ai_settings
for insert
to authenticated
with check (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'settings.manage')
);

create policy "service_quote_ai_settings_update_company_admin"
on public.service_quote_ai_settings
for update
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'settings.manage')
)
with check (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'settings.manage')
);

create policy "service_document_ai_suggestions_read_company_member"
on public.service_document_ai_suggestions
for select
to authenticated
using (public.is_company_member(auth.uid(), company_id));

create policy "service_document_ai_suggestions_insert_company_member"
on public.service_document_ai_suggestions
for insert
to authenticated
with check (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'documents.create')
);

create policy "service_document_ai_suggestions_update_company_member"
on public.service_document_ai_suggestions
for update
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and (
    public.has_company_permission(auth.uid(), company_id, 'documents.create')
    or public.has_company_permission(auth.uid(), company_id, 'documents.edit')
  )
)
with check (
  public.is_company_member(auth.uid(), company_id)
  and (
    public.has_company_permission(auth.uid(), company_id, 'documents.create')
    or public.has_company_permission(auth.uid(), company_id, 'documents.edit')
  )
);
