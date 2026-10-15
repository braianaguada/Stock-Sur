-- Staging only: npx supabase db query --linked --file scripts/product-details-qa.sql
begin;
do $$
declare actor uuid; company uuid; provider uuid; item uuid; payload jsonb;
begin
 select cu.user_id,cu.company_id into actor,company from public.company_users cu
 join public.companies c on c.id=cu.company_id and c.status='ACTIVE'
 where public.is_company_member(cu.user_id,cu.company_id) limit 1;
 if actor is null then raise exception 'Active staging member required'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 insert into public.suppliers(company_id,name) values(company,'QA structured supplier') returning id into provider;
 insert into public.items(company_id,sku,name,unit,supplier_id,description,technical_notes,structured_attributes,weight,length)
 values(company,'','QA structured product','un',provider,'Complete description','Technical note','{"Material":"Cobre"}',1.25,30) returning id into item;
 if not exists(select 1 from public.items where id=item and supplier='QA structured supplier' and supplier_id=provider) then raise exception 'Supplier sync failed'; end if;
 payload:=public.list_items_page(company,'QA structured product');
 if not exists(select 1 from jsonb_array_elements(payload->'items') r where r->>'supplier_id'=provider::text and (r->>'weight')::numeric=1.25) then raise exception 'Page details missing: %',payload; end if;
 update public.items set supplier='QA legacy import supplier' where id=item;
 if exists(select 1 from public.items where id=item and supplier_id is not null) then raise exception 'Legacy import retained obsolete association'; end if;
 begin
  update public.items set weight=-1 where id=item;
  raise exception 'Negative weight accepted';
 exception when check_violation then null; end;
 begin
  update public.items set supplier_id=gen_random_uuid() where id=item;
  raise exception 'Foreign supplier accepted';
 exception when foreign_key_violation then null; end;
 insert into public.item_aliases(company_id,item_id,alias,is_supplier_code,supplier_id) values(company,item,'QA supplier code',true,provider);
 raise notice 'PASS: details, supplier synchronization, legacy import, validation and provider code';
end $$;
rollback;
