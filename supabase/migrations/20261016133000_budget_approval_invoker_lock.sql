begin;

-- Serialize approval without requiring UPDATE access to an already sent budget.
create or replace function public.approve_budget_create_remito(p_document_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_source public.documents%rowtype;
  v_target uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('budget-approval:' || p_document_id::text, 0));
  select * into v_source from public.documents where id = p_document_id;
  if not found then raise exception 'Presupuesto no disponible'; end if;
  if not public.has_company_permission(auth.uid(), v_source.company_id, 'documents.approve')
     or not public.has_company_permission(auth.uid(), v_source.company_id, 'documents.create') then
    raise exception 'Necesitas permisos para aprobar presupuestos y crear documentos';
  end if;
  if v_source.doc_type <> 'PRESUPUESTO' or v_source.status not in ('ENVIADO', 'APROBADO') then
    raise exception 'Solo se puede aprobar un presupuesto enviado';
  end if;

  -- The source lock serializes repeated clicks without generating duplicate drafts.
  select id into v_target from public.documents
  where company_id = v_source.company_id and source_document_id = v_source.id
    and doc_type = 'REMITO' and status <> 'ANULADO'
  order by created_at limit 1;
  if found then return v_target; end if;

  if not exists (select 1 from public.document_lines where document_id = v_source.id)
     or exists (select 1 from public.document_lines where document_id = v_source.id and item_id is null) then
    raise exception 'Completa los productos del presupuesto antes de aprobarlo';
  end if;
  if v_source.status = 'ENVIADO' then
    perform public.transition_document_status(v_source.id, 'APROBADO');
  end if;

  insert into public.documents (
    company_id, doc_type, status, point_of_sale, customer_id, technician_id,
    customer_name, customer_tax_condition, customer_tax_id, customer_kind,
    payment_terms, delivery_address, salesperson, price_list_id, notes,
    source_document_id, source_document_type, source_document_number_snapshot,
    subtotal, tax_total, total, created_by
  ) values (
    v_source.company_id, 'REMITO', 'BORRADOR', v_source.point_of_sale,
    case when v_source.customer_kind = 'INTERNO' then null else v_source.customer_id end,
    case when v_source.customer_kind = 'INTERNO' then null else v_source.technician_id end,
    case when v_source.customer_kind = 'INTERNO' then null else v_source.customer_name end,
    case when v_source.customer_kind = 'INTERNO' then null else v_source.customer_tax_condition end,
    case when v_source.customer_kind = 'INTERNO' then null else v_source.customer_tax_id end,
    case when v_source.customer_kind = 'INTERNO' then 'GENERAL'::public.document_customer_kind else v_source.customer_kind end,
    case when v_source.customer_kind = 'INTERNO' then null else v_source.payment_terms end,
    v_source.delivery_address, v_source.salesperson, v_source.price_list_id, v_source.notes,
    v_source.id, v_source.doc_type,
    lpad(v_source.point_of_sale::text, 4, '0') || '-' || lpad(v_source.document_number::text, 8, '0'),
    round(v_source.total / 1.21, 2), v_source.total - round(v_source.total / 1.21, 2), v_source.total, auth.uid()
  ) returning id into v_target;

  insert into public.document_lines (
    document_id, line_order, item_id, sku_snapshot, description, unit, quantity,
    unit_price, tax_pct, pricing_mode, suggested_unit_price, base_cost_snapshot,
    list_flete_pct_snapshot, list_utilidad_pct_snapshot, list_impuesto_pct_snapshot,
    manual_margin_pct, price_overridden_by, price_overridden_at, discount_pct, line_total, created_by
  ) select v_target, line_order, item_id, sku_snapshot, description, unit, quantity,
    unit_price, 21, pricing_mode, suggested_unit_price, base_cost_snapshot,
    list_flete_pct_snapshot, list_utilidad_pct_snapshot, list_impuesto_pct_snapshot,
    manual_margin_pct, price_overridden_by, price_overridden_at, discount_pct, line_total, auth.uid()
  from public.document_lines where document_id = v_source.id;

  insert into public.document_events(document_id, event_type, payload, created_by) values
    (v_target, 'CREATED', jsonb_build_object('source', 'budget_conversion', 'source_document_id', v_source.id), auth.uid()),
    (v_source.id, 'REMITO_CREATED_FROM_BUDGET', jsonb_build_object('target_document_id', v_target), auth.uid());
  return v_target;
end;
$$;
revoke all on function public.approve_budget_create_remito(uuid) from public, anon;
grant execute on function public.approve_budget_create_remito(uuid) to authenticated;
commit;
