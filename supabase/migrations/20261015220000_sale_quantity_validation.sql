begin;
create function public.normalize_sale_unit(p_unit text) returns text
language sql immutable set search_path=public as $$
 select case lower(trim(coalesce(p_unit,'')))
 when 'unidad' then 'un' when 'unidades' then 'un' when 'u' then 'un' when 'und' then 'un' when 'uds' then 'un'
 when 'kilo' then 'kg' when 'kilos' then 'kg' when 'kilogramo' then 'kg' when 'kilogramos' then 'kg'
 when 'gramo' then 'g' when 'gramos' then 'g'
 when 'l' then 'lt' when 'litro' then 'lt' when 'litros' then 'lt'
 when 'metro' then 'm' when 'metros' then 'm' when 'mts' then 'm' when 'mt' then 'm'
 when 'centimetro' then 'cm' when 'centimetros' then 'cm'
 when 'mililitro' then 'ml' when 'mililitros' then 'ml'
 else lower(trim(coalesce(p_unit,''))) end;
$$;
revoke all on function public.normalize_sale_unit(text) from public,anon;
grant execute on function public.normalize_sale_unit(text) to authenticated,service_role;
create function public.normalize_item_sale_unit() returns trigger
language plpgsql set search_path=public as $$
begin new.unit:=public.normalize_sale_unit(new.unit); return new; end $$;
revoke all on function public.normalize_item_sale_unit() from public,anon,authenticated;
create trigger normalize_item_sale_unit before insert or update of unit on public.items
for each row execute function public.normalize_item_sale_unit();

create function public.validate_stock_sale_quantity() returns trigger
language plpgsql set search_path=public as $$
declare sale_unit text;
begin
 if TG_OP='UPDATE' then
  if (new.quantity,new.item_id,new.company_id) is not distinct from (old.quantity,old.item_id,old.company_id) then return new; end if;
 end if;
 select unit into sale_unit from public.items where id=new.item_id and company_id=new.company_id;
 if not found then raise exception 'Producto inexistente o de otra empresa' using errcode='23514'; end if;
 if new.quantity is null or new.quantity::text in ('NaN','Infinity','-Infinity') then
  raise exception 'La cantidad debe ser un numero valido' using errcode='23514'; end if;
 if public.normalize_sale_unit(sale_unit)='un' and trunc(new.quantity)<>new.quantity then
  raise exception 'Este producto se vende por unidad entera. Ingresa una cantidad sin decimales.' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function public.validate_stock_sale_quantity() from public,anon,authenticated;
create trigger validate_stock_sale_quantity before insert or update of quantity,item_id,company_id on public.stock_movements
for each row execute function public.validate_stock_sale_quantity();

create function public.validate_document_sale_quantity() returns trigger
language plpgsql set search_path=public as $$
declare company uuid; sale_unit text;
begin
 if TG_OP='UPDATE' then
  if (new.quantity,new.unit,new.item_id,new.document_id) is not distinct from (old.quantity,old.unit,old.item_id,old.document_id) then return new; end if;
 end if;
 select company_id into company from public.documents where id=new.document_id;
 if not found then raise exception 'Documento inexistente o no accesible' using errcode='23514'; end if;
 if new.item_id is not null then
  select unit into sale_unit from public.items where id=new.item_id and company_id=company;
  if not found then raise exception 'Producto inexistente o de otra empresa' using errcode='23514'; end if;
 else sale_unit:=new.unit; end if;
 new.unit:=public.normalize_sale_unit(sale_unit);
 if new.quantity is null or new.quantity::text in ('NaN','Infinity','-Infinity') then
  raise exception 'La cantidad debe ser un numero valido' using errcode='23514'; end if;
 if new.unit='un' and trunc(new.quantity)<>new.quantity then
  raise exception 'Este producto se vende por unidad entera. Ingresa una cantidad sin decimales.' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function public.validate_document_sale_quantity() from public,anon,authenticated;
create trigger validate_document_sale_quantity before insert or update of quantity,unit,item_id,document_id on public.document_lines
for each row execute function public.validate_document_sale_quantity();
commit;
