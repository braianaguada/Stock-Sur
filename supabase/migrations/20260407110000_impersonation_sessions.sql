create table if not exists public.impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  reason text null,
  status text not null default 'ACTIVE',
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  ended_by_user_id uuid null references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  constraint impersonation_sessions_actor_target_check check (actor_user_id <> target_user_id),
  constraint impersonation_sessions_status_check check (status in ('ACTIVE', 'ENDED'))
);

create index if not exists impersonation_sessions_actor_idx
  on public.impersonation_sessions (actor_user_id, started_at desc);

create index if not exists impersonation_sessions_target_idx
  on public.impersonation_sessions (target_user_id, started_at desc);

create unique index if not exists impersonation_sessions_one_active_per_actor_idx
  on public.impersonation_sessions (actor_user_id)
  where status = 'ACTIVE';

alter table public.impersonation_sessions enable row level security;

create policy "impersonation_sessions_select_superadmin"
on public.impersonation_sessions
for select
to authenticated
using (public.is_superadmin(auth.uid()));

create policy "impersonation_sessions_insert_superadmin"
on public.impersonation_sessions
for insert
to authenticated
with check (
  public.is_superadmin(auth.uid())
  and actor_user_id = auth.uid()
);

create policy "impersonation_sessions_update_superadmin"
on public.impersonation_sessions
for update
to authenticated
using (public.is_superadmin(auth.uid()) and actor_user_id = auth.uid())
with check (public.is_superadmin(auth.uid()) and actor_user_id = auth.uid());
