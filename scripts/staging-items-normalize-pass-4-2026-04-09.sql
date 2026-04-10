begin;

-- Clean the last obvious brand/model leftovers in staging.
update public.items
set name = 'LONG TERM'
where sku = 'SS-000049';

update public.items
set name = 'BALANZA ELECTRONICA PROGR'
where sku = 'SS-000024';

update public.items
set name = 'PINZA AMPEROMETRICA C/CAPACIMETRO'
where sku = 'SS-000037';

update public.items
set name = 'SOPLETE CON CHISPERO Y MANGUERA'
where sku = 'SS-000038';

update public.items
set
  name = 'CAPACIMETRO BELLINI',
  model = null
where sku = 'SS-000041'
  and model = '1MF-999MF';

update public.items
set name = 'JUEGO.MANGUERAS LAX 1/4S'
where sku = 'SS-000047';

update public.items
set name = 'JUEGO.MANGUERAS LAX 1/2 SAE'
where sku = 'SS-000048';

update public.items
set
  brand = 'DSZH',
  name = 'MANIFOLD R20/R134 BLISTER'
where sku = 'SS-000050';

update public.items
set
  brand = 'PROSKIT',
  name = 'TESTER DIGITAL'
where sku = 'SS-000054';

update public.items
set name = 'CONTROL REMOTO UNIVERSAL 1000EN1'
where sku = 'SS-000058';

update public.items
set
  name = 'BIMETAL ENCAPSULADO KSD-THX'
where sku = 'BIMETAL-ENCA-0653';

update public.items
set
  name = 'BI-METAL SIN DIODO',
  model = null
where sku = 'SS-000217'
  and model = 'BI-METAL';

-- Fix malformed capacitor models that captured the voltage instead of the real series.
update public.items
set model = 'CBB60'
where sku in ('SS-000221', 'SS-000222', 'SS-000223', 'SS-000228')
  and model = '450VAC-50';

update public.items
set name = trim(
  regexp_replace(
    regexp_replace(name, '\s*-?C?C?BB60\s*$', '', 'i'),
    '\s{2,}',
    ' ',
    'g'
  )
)
where sku in ('SS-000221', 'SS-000222', 'SS-000223', 'SS-000228');

commit;
