begin;

-- Complete the remaining staging categories with deterministic rules.
update public.items
set
  category = 'COMPRESOR',
  name = case
    when sku = 'COMPRESOR-DA-6888' then 'COMPRESOR'
    else name
  end
where (category is null or btrim(category) = '')
  and upper(name) like 'COMPRESOR%';

update public.items
set
  category = 'GAS/ACEITE',
  brand = case
    when sku = 'VARILLA-BLOC-4362' then 'BLOCKADE'
    when sku = 'VARILLA-ZINC-8951' then 'ZINCAFLUX'
    else brand
  end,
  name = case
    when sku = 'VARILLA-BLOC-4362' then 'VARILLA LATON'
    when sku = 'VARILLA-ZINC-8951' then 'VARILLA'
    else name
  end
where (category is null or btrim(category) = '')
  and upper(name) like 'VARILLA%';

update public.items
set
  category = 'FORZADOR/TURBINA',
  model = coalesce(nullif(btrim(model), ''), 'CT3C')
where sku = 'VT-FAN-CT3E-7232'
  and (category is null or btrim(category) = '');

update public.items
set category = 'REPUESTOS VARIOS'
where sku in ('BOMBA-LAVARR-5969', 'SS-000296')
  and (category is null or btrim(category) = '');

update public.items
set
  category = 'REPUESTOS VARIOS',
  brand = 'SKF',
  model = '6205 2RSH/C3',
  name = 'RULEMAN'
where sku = 'RULEMAN-SKF--2508'
  and (category is null or btrim(category) = '');

update public.items
set
  category = 'INSUMOS VARIOS',
  model = '009',
  name = 'OJO DE BUEY'
where sku = 'OJO-DE-BUEY--9878'
  and (category is null or btrim(category) = '');

update public.items
set
  category = 'REPUESTOS VARIOS',
  name = 'ACUMULADOR SUCCION 3/4 ODF'
where sku = 'ACUMULADOR-S-1378'
  and (category is null or btrim(category) = '');

update public.items
set category = 'COMPONENTE ELECTRICO'
where sku in ('KIT-ARRANQUE-7763', 'SS-000244')
  and (category is null or btrim(category) = '');

update public.items
set category = 'VALVULA'
where sku in ('TOBERA-1121', 'SS-000214', 'SS-000102')
  and (category is null or btrim(category) = '');

update public.items
set
  category = 'HERRAMIENTA',
  brand = 'LONG TERM',
  model = 'LT-808-F'
where sku = 'SS-000049'
  and (category is null or btrim(category) = '');

update public.items
set category = 'QA'
where sku = 'QA-MULTI-SEC'
  and (category is null or btrim(category) = '');

-- Fix a few obvious brand/model leftovers still embedded in the staging name.
update public.items
set
  brand = 'PANASONIC',
  name = 'PILA AA'
where sku = 'SS-000062'
  and coalesce(brand, '') = '';

update public.items
set
  brand = 'PANASONIC',
  name = 'PILA AAA'
where sku = 'SS-000063'
  and coalesce(brand, '') = '';

update public.items
set
  brand = 'CUBIGEL',
  model = coalesce(nullif(btrim(model), ''), '406884'),
  name = 'RELE TERMICO'
where sku = 'RELE-TERMICO-9680'
  and coalesce(brand, '') = '';

update public.items
set
  brand = 'HONEYWELL',
  name = 'TERMOSTATO VISION PRO 8000 R1008'
where sku = 'TERMOSTATO-H-8469'
  and coalesce(brand, '') = '';

update public.items
set
  brand = 'BLUESTAR',
  name = 'FILTRO 1 1/8 SAE'
where sku = 'FILTRO-BLUES-0619'
  and coalesce(brand, '') = '';

commit;
