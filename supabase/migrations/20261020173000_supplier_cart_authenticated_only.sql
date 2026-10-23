-- Legacy explicit anon grants are not removed by revoking PUBLIC.
begin;
revoke all on function public.create_supplier_purchase_order(uuid, uuid, uuid, jsonb, text) from anon;
grant execute on function public.create_supplier_purchase_order(uuid, uuid, uuid, jsonb, text) to authenticated;
commit;
