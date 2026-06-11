revoke all on function public.save_service_document(
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
) from public;
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

revoke all on function public.transition_service_document_status(uuid, public.service_document_status) from public;
grant execute on function public.transition_service_document_status(uuid, public.service_document_status) to authenticated;

revoke all on function public.create_service_document_copy(uuid, public.service_document_type) from public;
grant execute on function public.create_service_document_copy(uuid, public.service_document_type) to authenticated;

revoke all on function public.create_service_document_share_link(uuid, timestamptz) from public;
grant execute on function public.create_service_document_share_link(uuid, timestamptz) to authenticated;

revoke all on function public.revoke_service_document_share_link(text) from public;
grant execute on function public.revoke_service_document_share_link(text) to authenticated;

revoke all on function public.cancel_cash_expense(uuid, text) from public;
grant execute on function public.cancel_cash_expense(uuid, text) to authenticated;

notify pgrst, 'reload schema';
