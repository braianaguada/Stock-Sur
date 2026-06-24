create extension if not exists pg_trgm;

create or replace function public.normalize_item_search_text(value text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select trim(
    regexp_replace(
      translate(
        lower(coalesce(value, '')),
        'áéíóúüñ',
        'aeiouun'
      ),
      '[^a-z0-9/+\.\-]+',
      ' ',
      'g'
    )
  );
$$;

alter table public.items
  add column if not exists search_text text generated always as (
    public.normalize_item_search_text(
      coalesce(sku, '') || ' ' ||
      coalesce(name, '') || ' ' ||
      coalesce(supplier, '') || ' ' ||
      coalesce(brand, '') || ' ' ||
      coalesce(model, '') || ' ' ||
      coalesce(attributes, '') || ' ' ||
      coalesce(category, '') || ' ' ||
      coalesce(unit, '')
    )
  ) stored;

alter table public.item_aliases
  add column if not exists search_text text generated always as (
    public.normalize_item_search_text(alias)
  ) stored;

create index if not exists items_search_text_trgm_idx
  on public.items using gin (search_text gin_trgm_ops);

create index if not exists item_aliases_search_text_trgm_idx
  on public.item_aliases using gin (search_text gin_trgm_ops);

create or replace function public.search_items(
  p_company_id uuid,
  p_query text,
  p_limit integer default 20
)
returns table (
  id uuid,
  name text,
  sku text,
  unit text,
  supplier text,
  brand text,
  model text,
  attributes text,
  category text
)
language sql
stable
security invoker
set search_path = public
as $$
  with query_data as (
    select
      public.normalize_item_search_text(p_query) as phrase,
      regexp_split_to_array(public.normalize_item_search_text(p_query), '\s+') as tokens
  )
  select
    i.id,
    i.name,
    i.sku,
    i.unit,
    i.supplier,
    i.brand,
    i.model,
    i.attributes,
    i.category
  from public.items i
  cross join query_data q
  where i.company_id = p_company_id
    and i.is_active = true
    and q.phrase <> ''
    and not exists (
      select 1
      from unnest(q.tokens) token
      where token <> ''
        and i.search_text not like '%' || token || '%'
        and not exists (
          select 1
          from public.item_aliases ia
          where ia.company_id = i.company_id
            and ia.item_id = i.id
            and ia.search_text like '%' || token || '%'
        )
    )
  order by
    case
      when public.normalize_item_search_text(i.sku) = q.phrase then 0
      when public.normalize_item_search_text(i.name) = q.phrase then 1
      when public.normalize_item_search_text(i.sku) like q.phrase || '%' then 2
      when public.normalize_item_search_text(i.name) like q.phrase || '%' then 3
      when i.search_text like '%' || q.phrase || '%' then 4
      else 5
    end,
    i.name
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

grant execute on function public.search_items(uuid, text, integer) to authenticated;
