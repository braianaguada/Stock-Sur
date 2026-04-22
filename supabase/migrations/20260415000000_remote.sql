-- Add index to speed up movement aggregation
create index if not exists idx_stock_movements_item_company 
on public.stock_movements(item_id, company_id);
-- Optimized RPC: only sum movements, don't join items
create or replace function public.get_stock_levels(p_company_id uuid)
returns table (
  item_id uuid,
  total_stock numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    sm.item_id,
    coalesce(sum(
      case sm.type
        when 'IN' then sm.quantity
        when 'OUT' then -sm.quantity
        else sm.quantity
      end
    ), 0) as total_stock
  from public.stock_movements sm
  where sm.company_id = p_company_id
  group by sm.item_id;
end;
$$;
grant execute on function public.get_stock_levels(uuid) to authenticated;
notify pgrst, 'reload schema';
