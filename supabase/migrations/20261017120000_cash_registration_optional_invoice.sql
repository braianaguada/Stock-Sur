-- Keep invoice association and cash registration in the same transaction.
create or replace function public.register_cash_sale_from_remito_with_invoice(
  p_company_id uuid,
  p_document_id uuid,
  p_payment_method public.cash_payment_method,
  p_external_invoice_number text
)
returns public.cash_sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.documents%rowtype;
  v_invoice text := nullif(btrim(p_external_invoice_number), '');
begin
  if auth.uid() is null or not public.has_company_permission(auth.uid(), p_company_id, 'cash.create') then
    raise exception 'No tenes permiso para registrar ventas en esta empresa';
  end if;

  select * into v_doc from public.documents
  where id = p_document_id and company_id = p_company_id
  for update;
  if not found then
    raise exception 'No se encontro el remito en esta empresa';
  end if;
  if v_doc.doc_type <> 'REMITO' or v_doc.status <> 'EMITIDO' then
    raise exception 'Solo se pueden registrar remitos emitidos';
  end if;

  -- Matching references are left untouched so retries remain idempotent.
  if v_invoice is not null and (
    v_doc.external_invoice_status is distinct from 'ACTIVE'
    or v_doc.external_invoice_number is distinct from v_invoice
  ) then
    perform public.set_document_external_invoice(p_document_id, v_invoice, null);
  end if;

  return public.register_cash_sale_from_remito(p_company_id, p_document_id, p_payment_method);
end;
$$;
revoke all on function public.register_cash_sale_from_remito_with_invoice(uuid, uuid, public.cash_payment_method, text) from public, anon;
grant execute on function public.register_cash_sale_from_remito_with_invoice(uuid, uuid, public.cash_payment_method, text) to authenticated;
