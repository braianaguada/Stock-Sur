-- Keep the dashboard RPC contracts stable while preventing stock data from
-- reaching company members without the effective stock.view permission.
--
-- The previous implementations remain private to the database owner. The
-- public wrappers apply the authorization boundary to the complete JSON result
-- before it can cross the RPC boundary.

alter function public.get_dashboard_operational_overview(uuid)
  rename to _get_dashboard_operational_overview_impl;

revoke all on function public._get_dashboard_operational_overview_impl(uuid) from public;
revoke all on function public._get_dashboard_operational_overview_impl(uuid) from authenticated;

create or replace function public.get_dashboard_operational_overview(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_can_stock boolean;
  v_result jsonb;
  v_actions jsonb;
begin
  if v_actor is null or not public.is_company_member(v_actor, p_company_id) then
    raise exception 'No tienes acceso a la empresa indicada';
  end if;

  v_can_stock := public.has_company_permission(v_actor, p_company_id, 'stock.view');
  v_result := public._get_dashboard_operational_overview_impl(p_company_id);

  v_result := jsonb_set(
    v_result,
    '{capabilities}',
    coalesce(v_result -> 'capabilities', '{}'::jsonb)
      || jsonb_build_object('stock', v_can_stock),
    true
  );

  if not v_can_stock then
    v_result := jsonb_set(
      v_result,
      '{metrics}',
      coalesce(v_result -> 'metrics', '{}'::jsonb)
        - 'inventoryValue'
        - 'inventoryUnits'
        - 'itemsWithStock'
        - 'activeItems'
        - 'itemsWithoutCost'
        - 'valuedItemsShare',
      true
    );

    select coalesce(jsonb_agg(action), '[]'::jsonb)
    into v_actions
    from jsonb_array_elements(coalesce(v_result -> 'actions', '[]'::jsonb)) action
    where action ->> 'key' <> 'missing-cost';

    v_result := jsonb_set(v_result, '{actions}', v_actions, true)
      - 'topItemsByValue'
      - 'categoryValues';
  end if;

  return v_result;
end;
$$;

revoke all on function public.get_dashboard_operational_overview(uuid) from public;
grant execute on function public.get_dashboard_operational_overview(uuid) to authenticated;

alter function public.get_dashboard_business_insights(uuid)
  rename to _get_dashboard_business_insights_impl;

revoke all on function public._get_dashboard_business_insights_impl(uuid) from public;
revoke all on function public._get_dashboard_business_insights_impl(uuid) from authenticated;

create or replace function public.get_dashboard_business_insights(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_can_stock boolean;
  v_result jsonb;
begin
  if v_actor is null or not public.is_company_member(v_actor, p_company_id) then
    raise exception 'No tienes acceso a la empresa indicada';
  end if;

  v_can_stock := public.has_company_permission(v_actor, p_company_id, 'stock.view');
  v_result := public._get_dashboard_business_insights_impl(p_company_id);

  v_result := jsonb_set(
    v_result,
    '{capabilities}',
    coalesce(v_result -> 'capabilities', '{}'::jsonb)
      || jsonb_build_object('stock', v_can_stock),
    true
  );

  if not v_can_stock then
    v_result := jsonb_set(
      v_result,
      '{metrics}',
      coalesce(v_result -> 'metrics', '{}'::jsonb)
        - 'slowStockValue'
        - 'slowStockItems',
      true
    )
      - 'slowStock'
      - 'stockVelocity';
  end if;

  return v_result;
end;
$$;

revoke all on function public.get_dashboard_business_insights(uuid) from public;
grant execute on function public.get_dashboard_business_insights(uuid) to authenticated;

notify pgrst, 'reload schema';
