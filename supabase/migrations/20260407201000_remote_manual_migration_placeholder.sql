-- Placeholder migration to align local history with a remote-only migration
-- that was applied manually outside this repository on 2026-04-07 20:10:00 UTC.
--
-- Current evidence:
-- - The version exists in both staging and production migration history.
-- - The SQL body could not be recovered from git history or `supabase migration fetch`.
-- - The follow-up change is captured in
--   `20260408001500_remove_email_superadmin_bootstrap.sql`.
--
-- This file is intentionally a no-op so local migration history matches the
-- remote environments and future `supabase db push` operations can proceed.

do $$
begin
  null;
end
$$;
