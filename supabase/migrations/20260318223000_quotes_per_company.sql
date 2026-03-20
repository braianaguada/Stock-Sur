alter table public.quotes
  add column if not exists company_id uuid null references public.companies(id) on delete cascade;

alter table public.quote_lines
  add column if not exists company_id uuid null references public.companies(id) on delete cascade;

do $$
declare
  v_company_id uuid;
begin
  select id
  into v_company_id
  from public.companies
  order by created_at
  limit 1;

  if v_company_id is null then
    raise exception 'No existe una empresa para vincular presupuestos';
  end if;

  update public.quotes
  set company_id = v_company_id
  where company_id is null;

  update public.quote_lines ql
  set company_id = q.company_id
  from public.quotes q
  where q.id = ql.quote_id
    and ql.company_id is null;
end
$$;

alter table public.quotes
  alter column company_id set not null;

alter table public.quote_lines
  alter column company_id set not null;

create index if not exists quotes_company_created_idx
  on public.quotes(company_id, created_at desc);

create index if not exists quote_lines_company_quote_idx
  on public.quote_lines(company_id, quote_id);

insert into public.permissions (code, module, action, description)
values
  ('quotes.view', 'quotes', 'view', 'Ver presupuestos'),
  ('quotes.create', 'quotes', 'create', 'Crear presupuestos'),
  ('quotes.edit', 'quotes', 'edit', 'Editar presupuestos'),
  ('quotes.delete', 'quotes', 'delete', 'Eliminar presupuestos'),
  ('quotes.print', 'quotes', 'print', 'Imprimir presupuestos')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = any (
  case r.code
    when 'admin' then array['quotes.view','quotes.create','quotes.edit','quotes.delete','quotes.print']
    when 'operador' then array['quotes.view','quotes.create','quotes.edit','quotes.delete','quotes.print']
    when 'consulta' then array['quotes.view','quotes.print']
    else array[]::text[]
  end
)
where r.scope = 'COMPANY'
on conflict do nothing;

create or replace function public.validate_quote_company()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_customer_company_id uuid;
begin
  if new.customer_id is null then
    return new;
  end if;

  select company_id
  into v_customer_company_id
  from public.customers
  where id = new.customer_id;

  if v_customer_company_id is null then
    raise exception 'El cliente asociado no existe';
  end if;

  if v_customer_company_id <> new.company_id then
    raise exception 'El cliente debe pertenecer a la misma empresa que el presupuesto';
  end if;

  return new;
end;
$$;

create or replace function public.validate_quote_line_company()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_quote_company_id uuid;
  v_item_company_id uuid;
begin
  select company_id
  into v_quote_company_id
  from public.quotes
  where id = new.quote_id;

  if v_quote_company_id is null then
    raise exception 'El presupuesto asociado no existe';
  end if;

  if new.company_id is null then
    new.company_id := v_quote_company_id;
  end if;

  if new.company_id <> v_quote_company_id then
    raise exception 'La linea debe pertenecer a la misma empresa que el presupuesto';
  end if;

  if new.item_id is not null then
    select company_id
    into v_item_company_id
    from public.items
    where id = new.item_id;

    if v_item_company_id is null then
      raise exception 'El item asociado no existe';
    end if;

    if v_item_company_id <> new.company_id then
      raise exception 'El item debe pertenecer a la misma empresa que la linea';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_quote_company_before_write on public.quotes;
create trigger validate_quote_company_before_write
before insert or update on public.quotes
for each row execute function public.validate_quote_company();

drop trigger if exists validate_quote_line_company_before_write on public.quote_lines;
create trigger validate_quote_line_company_before_write
before insert or update on public.quote_lines
for each row execute function public.validate_quote_line_company();

drop policy if exists "quotes_read_authenticated" on public.quotes;
drop policy if exists "quotes_insert_owner_or_admin" on public.quotes;
drop policy if exists "quotes_update_owner_or_admin" on public.quotes;
drop policy if exists "quotes_delete_owner_or_admin" on public.quotes;

create policy "quotes_read_company_member"
on public.quotes
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'quotes.view')
);

create policy "quotes_insert_company_member"
on public.quotes
for insert
to authenticated
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and public.has_company_permission(auth.uid(), company_id, 'quotes.create')
  and created_by = auth.uid()
);

create policy "quotes_update_company_member"
on public.quotes
for update
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'quotes.edit')
)
with check (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'quotes.edit')
);

create policy "quotes_delete_company_member"
on public.quotes
for delete
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'quotes.delete')
);

drop policy if exists "quote_lines_read_authenticated" on public.quote_lines;
drop policy if exists "quote_lines_insert_owner_or_admin" on public.quote_lines;
drop policy if exists "quote_lines_update_owner_or_admin" on public.quote_lines;
drop policy if exists "quote_lines_delete_owner_or_admin" on public.quote_lines;

create policy "quote_lines_read_company_member"
on public.quote_lines
for select
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'quotes.view')
);

create policy "quote_lines_insert_company_member"
on public.quote_lines
for insert
to authenticated
with check (
  company_id in (select public.get_user_company_ids(auth.uid()))
  and public.has_company_permission(auth.uid(), company_id, 'quotes.create')
  and created_by = auth.uid()
);

create policy "quote_lines_update_company_member"
on public.quote_lines
for update
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'quotes.edit')
)
with check (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'quotes.edit')
);

create policy "quote_lines_delete_company_member"
on public.quote_lines
for delete
to authenticated
using (
  public.is_company_member(auth.uid(), company_id)
  and public.has_company_permission(auth.uid(), company_id, 'quotes.delete')
);
