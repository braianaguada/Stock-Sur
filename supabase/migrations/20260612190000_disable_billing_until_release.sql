update public.billing_settings
set is_enabled = false
where is_enabled = true;
