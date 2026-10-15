begin;
-- Keep UUID relationships and historical document snapshots unchanged.
lock table public.items in share row exclusive mode;
create table if not exists public.item_code_counters (
  company_id uuid primary key references public.companies(id) on delete cascade,
  last_value numeric not null check (last_value >= 0 and scale(last_value) = 0)
);
alter table public.item_code_counters enable row level security;
revoke all on public.item_code_counters from public, anon, authenticated;
insert into public.item_code_counters(company_id,last_value)
select company_id,greatest(12440345902::numeric,coalesce(max(case when sku ~ '^[0-9]+$' then sku::numeric end),0))
from (
 select company_id,sku from public.items
 union all select company_id,alias as sku from public.item_aliases where alias ~ '^[0-9]+$'
) codes group by company_id
on conflict(company_id) do update set last_value=greatest(item_code_counters.last_value,excluded.last_value);
-- Preserve old visible codes before changing them. Imports already match aliases.
insert into public.item_aliases(company_id,item_id,alias,is_supplier_code)
select company_id,id,sku,false from public.items where sku !~ '^[0-9]+$'
on conflict (item_id,alias) do nothing;
with replacements as (
  select i.id,(c.last_value + row_number() over(partition by i.company_id order by i.created_at,i.id))::text as code
  from public.items i join public.item_code_counters c on c.company_id=i.company_id where i.sku !~ '^[0-9]+$'
)
update public.items i set sku=r.code from replacements r where i.id=r.id;
update public.item_code_counters c set last_value=greatest(c.last_value,s.last_value) from (
  select company_id,max(sku::numeric) as last_value from public.items where sku ~ '^[0-9]+$' group by company_id
) s where s.company_id=c.company_id;

create or replace function public.generate_sku() returns trigger language plpgsql security definer
set search_path=public,pg_temp as $$
declare assigned numeric;
begin
  if auth.uid() is not null and (not public.is_company_member(auth.uid(),new.company_id)
    or not exists(select 1 from public.companies where id=new.company_id and status='ACTIVE')) then
    raise exception 'Sin acceso al catalogo de esta empresa' using errcode='42501';
  end if;
  if tg_op='UPDATE' and new.company_id is distinct from old.company_id then
    raise exception 'No se puede trasladar un producto entre empresas' using errcode='42501';
  end if;
  if nullif(btrim(new.sku),'') is null then
    loop
      insert into public.item_code_counters(company_id,last_value) values(new.company_id,12440345903)
      on conflict(company_id) do update set last_value=item_code_counters.last_value+1
      returning last_value into assigned;
      exit when not exists(select 1 from public.items where company_id=new.company_id and sku=assigned::text)
        and not exists(select 1 from public.item_aliases where company_id=new.company_id and alias=assigned::text);
    end loop;
    new.sku := assigned::text;
  elsif new.sku ~ '^[0-9]+$' then
    insert into public.item_code_counters(company_id,last_value) values(new.company_id,greatest(12440345902,new.sku::numeric))
    on conflict(company_id) do update set last_value=greatest(item_code_counters.last_value,excluded.last_value);
  end if;
  return new;
end $$;
revoke all on function public.generate_sku() from public,anon,authenticated;
drop trigger set_item_sku on public.items;
create trigger set_item_sku before insert or update of sku,company_id on public.items
for each row execute function public.generate_sku();

create or replace function public.preserve_item_code_alias() returns trigger language plpgsql security definer
set search_path=public,pg_temp as $$
begin
  if old.sku is distinct from new.sku then
    insert into public.item_aliases(company_id,item_id,alias,is_supplier_code) values(new.company_id,new.id,old.sku,false)
    on conflict(item_id,alias) do nothing;
  end if;
  return new;
end $$;
revoke all on function public.preserve_item_code_alias() from public,anon,authenticated;
drop trigger if exists preserve_item_code_alias on public.items;
create trigger preserve_item_code_alias after update of sku on public.items
for each row execute function public.preserve_item_code_alias();
commit;
