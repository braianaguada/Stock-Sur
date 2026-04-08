drop policy if exists "item_pricing_base_history_insert_company_member" on public.item_pricing_base_history;

create policy "item_pricing_base_history_insert_company_member"
on public.item_pricing_base_history
for insert
to authenticated
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and public.has_company_permission(auth.uid(), company_id, 'price_lists.edit')
);

notify pgrst, 'reload schema';
