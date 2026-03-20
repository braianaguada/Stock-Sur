grant execute on function public.get_or_create_cash_closure(date) to authenticated;
grant execute on function public.recalculate_cash_closure_totals(uuid) to authenticated;
grant execute on function public.attach_cash_sale_receipt(uuid, public.cash_receipt_kind, uuid, text) to authenticated;
grant execute on function public.cancel_cash_sale(uuid, text) to authenticated;
grant execute on function public.close_cash_closure(uuid, numeric, numeric, numeric, text) to authenticated;
