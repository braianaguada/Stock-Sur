-- Staging only. Everything rolls back; no document is issued.
begin;
do $$
declare actor uuid; company uuid; item uuid; measured uuid; doc uuid;
begin
 select cu.user_id,cu.company_id into actor,company from public.company_users cu
 join public.companies c on c.id=cu.company_id and c.status='ACTIVE'
 where public.is_company_member(cu.user_id,cu.company_id) limit 1;
 if actor is null then raise exception 'Active staging member required'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 insert into public.items(company_id,sku,name,unit) values(company,'','QA whole units',' UNIDADES ') returning id into item;
 insert into public.items(company_id,sku,name,unit) values(company,'','QA measured units','metros') returning id into measured;
 if not exists(select 1 from public.items where id=item and unit='un') then raise exception 'Unit normalization failed'; end if;
 insert into public.documents(company_id,doc_type,status,customer_name,created_by) values(company,'PRESUPUESTO','BORRADOR','QA unit validation',actor) returning id into doc;
 begin
  insert into public.document_lines(document_id,item_id,description,unit,quantity,created_by) values(doc,item,'QA','kg',1.5,actor);
  raise exception 'Fractional unit document accepted';
 exception when check_violation then null; end;
 insert into public.document_lines(document_id,item_id,description,unit,quantity,created_by) values(doc,measured,'QA','m',1.5,actor);
 begin
  insert into public.stock_movements(company_id,item_id,type,quantity,reference,created_by) values(company,item,'IN',1.5,'QA',actor);
  raise exception 'Fractional unit stock accepted';
 exception when check_violation then null; end;
 insert into public.stock_movements(company_id,item_id,type,quantity,reference,created_by) values(company,measured,'IN',1.5,'QA',actor);
 insert into public.stock_movements(company_id,item_id,type,quantity,reference,created_by) values(company,item,'ADJUSTMENT',-1,'QA',actor);
 begin
  insert into public.document_lines(document_id,item_id,description,unit,quantity,created_by) values(doc,gen_random_uuid(),'QA','un',1,actor);
  raise exception 'Foreign or missing product accepted';
 exception when check_violation then null; end;
 raise notice 'PASS: normalized units, fractional measures, whole units, negative adjustment, tenant item validation';
end $$;
rollback;
