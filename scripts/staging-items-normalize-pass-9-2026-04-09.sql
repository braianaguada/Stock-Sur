begin;

-- CINTAS PVC
update public.items
set name = 'CINTA DE PVC',
    attributes = 'BLANCA | CON PEGAMENTO'
where sku = 'SS-000109';

update public.items
set name = 'CINTA DE PVC',
    attributes = 'BLANCA | SIN PEGAMENTO'
where sku = 'SS-000110';

-- ACOPLES / ADAPTADORES
update public.items
set name = 'ACOPLE DESAGOTE',
    attributes = 'CONDENSADORA'
where sku = 'ACOPLE-DESAG-9293';

update public.items
set name = 'ACOPLE RAPIDO',
    attributes = 'ALTA PRESION'
where sku = 'ACOPLE-RAPID-8411';

update public.items
set name = 'ACOPLE RAPIDO',
    attributes = 'BAJA PRESION'
where sku = 'ACOPLE-RAPID-7307';

update public.items
set name = 'ADAPTADOR MANGUERA',
    attributes = 'R22'
where sku = 'ADAPTADOR-R2-4269';

update public.items
set name = 'ADAPTADOR MANGUERA',
    attributes = 'R410 | 5/16'
where sku = 'SS-000069';

-- BIMETALES
update public.items
set name = 'BIMETAL',
    attributes = 'CON DIODO'
where sku = 'BIMETAL-CON--4644';

update public.items
set name = 'BIMETAL',
    attributes = 'SIN DIODO'
where sku = 'BIMETAL-SIN--4628';

update public.items
set name = 'BIMETAL',
    attributes = 'ENCAPSULADO'
where sku = 'BIMETAL-ENCA-0653';

-- CAJAS PREINSTALACION
update public.items
set name = 'CAJA PREINSTALACION',
    attributes = 'HORIZONTAL'
where sku = 'ITEM-2246';

update public.items
set name = 'CAJA PREINSTALACION',
    attributes = 'VERTICAL'
where sku = 'ITEM-4183';

update public.items
set name = 'CAJA PREINSTALACION',
    attributes = 'RECI'
where sku = 'SS-000107';

-- COMPROBADOR
update public.items
set name = 'COMPROBADOR DE PLAQUETA INVERTER',
    brand = 'BELLINI'
where sku = 'SS-000042';

-- CORTADORAS
update public.items
set name = 'CORTADORA CAÑO',
    attributes = 'MEDIANA'
where sku = 'CORTADORA-CA-2673';

update public.items
set name = 'CORTADORA CAÑO',
    attributes = 'MINI'
where sku = 'SS-000059';

-- RELAY -> RELE
update public.items
set name = 'RELE'
where name = 'RELAY';

update public.items
set attributes = trim(replace(attributes, 'T/COMPELA ', ''))
where name = 'RELE' and attributes like 'T/COMPELA %';

update public.items
set attributes = trim(regexp_replace(attributes, '\s+', ' ', 'g'))
where attributes is not null;

commit;
