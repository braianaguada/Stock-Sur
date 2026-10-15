begin;

alter table public.items
  add column supplier_id uuid,
  add column description text,
  add column technical_notes text,
  add column structured_attributes jsonb not null default '{}'::jsonb,
  add column weight numeric,
  add column weight_unit text not null default 'kg',
  add column length numeric,
  add column width numeric,
  add column height numeric,
  add column dimension_unit text not null default 'cm';
alter table public.items
  add constraint items_weight_check check (weight is null or (weight >= 0 and weight < 'Infinity'::numeric)),
  add constraint items_weight_unit_check check (weight_unit in ('g','kg')),
  add constraint items_dimensions_check check (
    (length is null or (length >= 0 and length < 'Infinity'::numeric)) and
    (width is null or (width >= 0 and width < 'Infinity'::numeric)) and
    (height is null or (height >= 0 and height < 'Infinity'::numeric))),
  add constraint items_dimension_unit_check check (dimension_unit in ('mm','cm','m')),
  add constraint items_structured_attributes_check check (jsonb_typeof(structured_attributes) = 'object');
alter table public.suppliers add constraint suppliers_company_identity_key unique(company_id,id);
alter table public.items add constraint items_supplier_company_fkey
  foreign key(company_id,supplier_id) references public.suppliers(company_id,id);
alter table public.item_aliases add column supplier_id uuid;
alter table public.item_aliases add constraint item_aliases_supplier_company_fkey
  foreign key(company_id,supplier_id) references public.suppliers(company_id,id);
alter table public.item_aliases add constraint item_aliases_supplier_code_check
  check (supplier_id is null or is_supplier_code);
create index items_company_supplier_id_idx on public.items(company_id,supplier_id);
create index item_aliases_company_supplier_id_idx on public.item_aliases(company_id,supplier_id,item_id);
create index suppliers_company_normalized_name_idx on public.suppliers(company_id,lower(btrim(name)));

-- Only unambiguous active exact names are linked. Legacy text remains available.
with matches as (
  select i.id,(array_agg(s.id))[1] as supplier_id
  from public.items i join public.suppliers s on s.company_id=i.company_id
    and lower(btrim(s.name))=lower(btrim(i.supplier)) and s.is_active
  where nullif(btrim(i.supplier),'') is not null
  group by i.id having count(*)=1
)
update public.items i set supplier_id=m.supplier_id from matches m where i.id=m.id;

create function public.sync_item_supplier_reference()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_name text; v_active boolean; v_matches uuid[];
begin
  if new.supplier_id is not null then
    -- A legacy importer changing supplier text must not keep the old association.
    if tg_op='UPDATE' and new.supplier_id is not distinct from old.supplier_id
       and new.supplier is distinct from old.supplier then
      new.supplier_id:=null;
    else
      select s.name,s.is_active into v_name,v_active from public.suppliers s
        where s.company_id=new.company_id and s.id=new.supplier_id;
      if not found then raise exception 'Proveedor no disponible en esta empresa' using errcode='23503'; end if;
      if not v_active and (tg_op='INSERT' or new.supplier_id is distinct from old.supplier_id) then
        raise exception 'Selecciona un proveedor activo' using errcode='23514';
      end if;
      new.supplier:=v_name;
    end if;
  end if;
  if new.supplier_id is null and nullif(btrim(new.supplier),'') is not null then
    select array_agg(s.id) into v_matches from public.suppliers s
      where s.company_id=new.company_id and s.is_active and lower(btrim(s.name))=lower(btrim(new.supplier));
    if cardinality(v_matches)=1 then new.supplier_id:=v_matches[1]; end if;
  end if;
  return new;
end $$;
revoke all on function public.sync_item_supplier_reference() from public,anon,authenticated;
create trigger items_sync_supplier_reference before insert or update of supplier_id,supplier,company_id
  on public.items for each row execute function public.sync_item_supplier_reference();

create or replace function public.list_items_page(
  p_company_id uuid, p_search text default '', p_status text default 'active',
  p_category text default 'all', p_supplier text default 'all', p_stock text default 'all',
  p_sort text default 'name', p_direction text default 'asc',
  p_page integer default 1, p_page_size integer default 10
)
returns jsonb language plpgsql stable security invoker set search_path = public, pg_temp
as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not public.is_company_member(auth.uid(), p_company_id)
    or not exists(select 1 from public.companies where id = p_company_id and status = 'ACTIVE') then
    raise exception 'Sin acceso al catálogo de esta empresa' using errcode = '42501';
  end if;
  if p_page is null or p_page < 1 or p_page_size is null or p_page_size not between 1 and 200
    or p_status not in ('active','inactive','all') or p_stock not in ('all','in_stock','no_stock')
    or p_sort not in ('sku','name','supplier','brand','model','attributes','category','is_active','created_at','stock')
    or p_direction not in ('asc','desc') then
    raise exception 'Página o filtros de ítems inválidos' using errcode = '22023';
  end if;
  with stock as materialized (
    select sm.item_id, sum(public.stock_quantity_delta(sm.type::text, sm.quantity)) as stock
    from public.stock_movements sm where sm.company_id = p_company_id group by sm.item_id
  ), catalog as materialized (
    select i.id,i.sku,i.name,i.supplier,i.brand,i.model,i.attributes,i.unit,i.category,
      i.demand_profile,i.demand_monthly_estimate,i.is_active,i.created_at,coalesce(s.stock,0) as stock
    from public.items i left join stock s on s.item_id = i.id where i.company_id = p_company_id
  ), filtered as materialized (
    select c.* from catalog c
    where (p_status = 'all' or c.is_active = (p_status = 'active'))
      and (p_category = 'all' or c.category = p_category)
      and (p_supplier = 'all' or c.supplier = p_supplier)
      and (p_stock = 'all' or (p_stock = 'in_stock' and c.stock > 0) or (p_stock = 'no_stock' and c.stock <= 0))
      and public.catalog_search_matches(p_search, concat_ws(' ',c.sku,c.name,c.supplier,
        c.brand,c.model,c.attributes,c.category,c.unit,
        (select string_agg(a.alias,' ') from public.item_aliases a
          where a.company_id = p_company_id and a.item_id = c.id)))
  ), paging as (
    select count(*) as total, least(p_page::bigint,greatest(1::bigint,(count(*) + p_page_size - 1)/p_page_size)) as page
    from filtered
  ), visible as materialized (
    select f.* from filtered f
    order by
      case when p_sort = 'stock' and p_direction = 'asc' then stock end asc nulls last,
      case when p_sort = 'stock' and p_direction = 'desc' then stock end desc nulls last,
      case when p_direction = 'asc' and p_sort <> 'stock' then
        case p_sort when 'is_active' then is_active::text when 'created_at' then created_at::text
        else public.normalize_document_search(to_jsonb(f)->>p_sort) end end asc nulls last,
      case when p_direction = 'desc' and p_sort <> 'stock' then
        case p_sort when 'is_active' then is_active::text when 'created_at' then created_at::text
        else public.normalize_document_search(to_jsonb(f)->>p_sort) end end desc nulls last,
      name,id
    limit p_page_size offset ((select page from paging)-1)*p_page_size
  ), page_rows as (
    select v.*, row_number() over () as page_position from visible v
  )
  select jsonb_build_object('total',p.total,'page',p.page,
    'items',coalesce((select jsonb_agg((to_jsonb(v) - 'page_position') || jsonb_build_object(
      'supplier_id',details.supplier_id,'description',details.description,'technical_notes',details.technical_notes,
      'structured_attributes',details.structured_attributes,'weight',details.weight,'weight_unit',details.weight_unit,
      'length',details.length,'width',details.width,'height',details.height,'dimension_unit',details.dimension_unit,
      'base_cost',pb.base_cost,'main_price_original',price.calculated_price,'main_price_list_name',price.name) order by v.page_position)
      from page_rows v join public.items details on details.company_id=p_company_id and details.id=v.id left join public.item_pricing_base pb on pb.company_id = p_company_id and pb.item_id = v.id
      left join lateral (
        select pi.calculated_price,pl.name from public.price_list_items pi
        join public.price_lists pl on pl.id = pi.price_list_id and pl.company_id = p_company_id
        where pi.company_id = p_company_id and pi.item_id = v.id and pi.is_active
        order by (pl.status = 'UPDATED') desc,pl.name,pl.id limit 1
      ) price on true),'[]'::jsonb),
    'stats',(select jsonb_build_object('total',count(*),'active',count(*) filter(where is_active),
      'inStock',count(*) filter(where is_active and stock > 0),'noStock',count(*) filter(where is_active and stock <= 0)) from catalog),
    'categories',coalesce((select jsonb_agg(category order by category) from
      (select distinct category from catalog where category is not null) c),'[]'::jsonb),
    'suppliers',coalesce((select jsonb_agg(supplier order by supplier) from
      (select distinct supplier from catalog where supplier is not null) s),'[]'::jsonb))
  into v_result from paging p;
  return v_result;
end;
$$;

commit;
