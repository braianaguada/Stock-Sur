-- Staging: npx supabase db query --linked --file scripts/numeric-codes-qa.sql
-- Temporary catalog data only. Roll back all changes, including counters.
begin;
do $$
declare actor uuid; company uuid; a uuid; b uuid; code_a numeric; code_b numeric; old_code text;
begin
 select cu.user_id,cu.company_id into actor,company from public.company_users cu
 join public.companies c on c.id=cu.company_id and c.status='ACTIVE'
 where public.is_company_member(cu.user_id,cu.company_id) limit 1;
 if actor is null then raise exception 'Active staging member required'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('qa.codes_company',company::text,true);
 insert into public.items(company_id,sku,name,unit) values(company,'','QA numeric code','un') returning id,sku::numeric into a,code_a;
 insert into public.items(company_id,sku,name,unit) values(company,'','QA duplicate code','un') returning id,sku::numeric into b,code_b;
 if code_b<>code_a+1 or code_a<12440345903 then raise exception 'Sequence incorrect'; end if;
 old_code:=code_a::text;
 update public.items set sku=(code_b+10)::text where id=a;
 if not exists(select 1 from public.item_aliases where item_id=a and alias=old_code and company_id=company) then raise exception 'Previous code missing'; end if;
 insert into public.items(company_id,sku,name,unit) values(company,'','QA after manual code','un') returning sku::numeric into code_a;
 if code_a<>code_b+11 then raise exception 'Manual code did not advance sequence'; end if;
 insert into public.item_aliases(company_id,item_id,alias) values(company,b,(code_a+1)::text);
 insert into public.items(company_id,sku,name,unit) values(company,'','QA reserved alias','un') returning sku::numeric into code_b;
 if code_b<>code_a+2 then raise exception 'Numeric alias collision'; end if;
 if exists(select 1 from public.items where sku !~ '^[0-9]+$') then raise exception 'Legacy codes not migrated'; end if;
 raise notice 'PASS: migration, sequential codes, aliases, manual codes, reserved alias collision';
end $$;
set local role authenticated;
do $$
begin
 begin
  perform 1 from public.item_code_counters;
  raise exception 'Counter accessible';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.items(company_id,sku,name,unit) values(gen_random_uuid(),'','QA forbidden','un');
  raise exception 'Foreign company accepted';
 exception when insufficient_privilege then null; end;
 raise notice 'PASS: counter permissions and tenant isolation';
end $$;
rollback;
