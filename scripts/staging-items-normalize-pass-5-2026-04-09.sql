begin;

-- ACEITES
update public.items set name = 'ACEITE', attributes = '3.78 L' where sku = 'SS-000016';
update public.items set name = 'ACEITE', attributes = '4 L' where sku in ('ITEM-4398', 'ITEM-0134', 'ITEM-2622');
update public.items set name = 'ACEITE', attributes = 'AUTOMOTOR | 1 L' where sku = 'ACEITE-AUTOM-6181';
update public.items set name = 'ACEITE', attributes = 'BOMBA VACIO | 500 ML' where sku = 'ACEITE-BOMBA-8997';
update public.items set name = 'ACEITE', attributes = 'BOMBA DE VACIO | 1 L' where sku = 'SS-000014';
update public.items set name = 'ACEITE', attributes = 'POE | 1 L | R410 | R-407' where sku = 'SS-000015';

-- ACUMULADOR / ADAPTADOR
update public.items set name = 'ACUMULADOR SUCCION', attributes = '3/4 ODF' where sku = 'ACUMULADOR-S-1378';
update public.items set name = 'ADAPTADOR MANGUERA', attributes = 'R22' where sku = 'ADAPTADOR-R2-4269';
update public.items set name = 'ADAPTADOR MANIFOLD', attributes = 'R410 | 5/16' where sku = 'SS-000069';

-- AISLACION / BATERIA / BIMETAL
update public.items set name = 'AISLACION', attributes = '1/2 | 2 M' where sku = 'SS-000001';
update public.items set name = 'AISLACION', attributes = '1/4 | 2 M' where sku = 'SS-000002';
update public.items set name = 'AISLACION', attributes = '3/8 | 2 M' where sku = 'SS-000003';
update public.items set name = 'AISLACION', attributes = '5/8 | 2 M' where sku = 'SS-000004';
update public.items set name = 'AISLACION', attributes = '3/4 | 2 M' where sku = 'AISLACION-3--3293';
update public.items set name = 'BATERIA', attributes = '9 V' where sku = 'SS-000057';
update public.items set name = 'BIMETAL', attributes = '16 A | 250 V' where sku = 'BIMETAL-16A--1406';

-- BOBINAS
update public.items set name = 'BOBINA INVERSORA', attributes = '220 V' where sku = 'SS-000104';
update public.items set name = 'BOBINA INVERSORA', attributes = '24 V' where sku = 'SS-000105';
update public.items set name = 'BOBINA', attributes = 'CONTACTOR' where sku in ('BOBINA-P-CON-7695', 'BOBINA-P-CON-3192');
update public.items set name = 'BOBINA', attributes = 'CONTACTOR | 25 A 32 A | 220 V' where sku = 'SS-000190';
update public.items set name = 'BOBINA', attributes = 'CONTACTOR | 25 A 32 A | 24 V' where sku = 'SS-000191';
update public.items set name = 'BOBINA', attributes = 'CONTACTOR | 25 A 32 A | 380 V' where sku = 'SS-000192';
update public.items set name = 'BOBINA', attributes = 'CONTACTOR | 9 A 18 A | 220 V' where sku = 'SS-000193';
update public.items set name = 'BOBINA', attributes = 'CONTACTOR | 9 A 18 A | 24 V' where sku = 'SS-000194';
update public.items set name = 'BOBINA', attributes = 'CONTACTOR | 9 A 18 A | 380 V' where sku = 'SS-000195';

-- CAJAS / CAÑOS / CAPILARES
update public.items set name = 'CAJA', attributes = 'TERMOSTATO | GRANDE' where sku = 'SS-000218';
update public.items set name = 'CAJA PRE INSTALACION', attributes = '390 x 170 x 60 MM' where sku = 'SS-000106';
update public.items set name = 'CAÑO COBRE', attributes = '1/2' where sku = 'SS-000009';
update public.items set name = 'CAÑO COBRE', attributes = '1/4' where sku = 'SS-000010';
update public.items set name = 'CAÑO COBRE', attributes = '3/8' where sku = 'SS-000011';
update public.items set name = 'CAÑO COBRE', attributes = '5/8' where sku = 'SS-000012';
update public.items set name = 'CAÑO COBRE', attributes = '3/4' where sku = 'SS-000013';
update public.items set name = 'CAPILAR COBRE', attributes = '0.70 MM' where sku = 'SS-000005';
update public.items set name = 'CAPILAR COBRE', attributes = '0.80 MM' where sku = 'SS-000006';
update public.items set name = 'CAPILAR COBRE', attributes = '1.25 MM' where sku = 'SS-000007';
update public.items set name = 'CAPILAR COBRE', attributes = '1.50 MM' where sku = 'SS-000008';

-- CELDAS / CINTAS
update public.items set name = 'CELDA PELTIER', attributes = '30 x 30 MM | 12 V' where sku = 'SS-000240';
update public.items set name = 'CELDA PELTIER', attributes = '40 x 40 MM | 12 V' where sku in ('SS-000241', 'SS-000242', 'SS-000243');
update public.items set name = 'CINTA AISLADORA', brand = coalesce(brand, 'BAW'), attributes = '20 M' where sku = 'SS-000108';
update public.items set name = 'CINTA ALUMINIO', attributes = '50 MM x 50 M' where sku = 'SS-000197';

-- COBRE FORMADO
update public.items set name = 'CODO COBRE', attributes = trim(regexp_replace(name, '^CODO COBRE\\s*', '')) where name like 'CODO COBRE %';
update public.items set name = 'CURVA COBRE', attributes = trim(regexp_replace(name, '^CURVA COBRE\\s*', '')) where name like 'CURVA COBRE %';

-- COMBISTATOS / COMPRESORES
update public.items set name = 'COMBISTATO', attributes = '2 SONDAS' where sku in ('SS-000294', 'SS-000295');
update public.items
set name = 'COMPRESOR',
    attributes = trim(regexp_replace(name, '^COMPRESOR\\s*', ''))
where name like 'COMPRESOR %';

-- CONECTORES / CUPLAS
update public.items set name = 'CONECTOR', attributes = '1/4' where sku = 'CONECTOR-1-4-8147';
update public.items
set name = 'CUPLA REDUCCION',
    attributes = trim(regexp_replace(name, '^CUPLA REDUCCION\\s*', ''))
where name like 'CUPLA REDUCCION %';
update public.items
set name = 'CUPLA TRAFILADA',
    attributes = trim(regexp_replace(name, '^CUPLA TRAFILADA\\s*', ''))
where name like 'CUPLA TRAFILADA %';

-- DESTORNILLADORES / DOBLADORA / FICHAS
update public.items set name = 'DESTORNILLADOR', attributes = '0 x 75 | PHILIPS' where sku = 'DESTORNILLAD-1729';
update public.items set name = 'DESTORNILLADOR', attributes = '5.0 x 100 | PALETA' where sku = 'DESTORNILLAD-8513';
update public.items set name = 'DESTORNILLADOR', attributes = '5.0 x 70 | PALETA' where sku = 'DESTORNILLAD-8129';
update public.items set name = 'DESTORNILLADOR', attributes = '6.0 x 150 | PALETA' where sku = 'DESTORNILLAD-3193';
update public.items set name = 'DOBLADORA DE CAÑO', attributes = '3 EN 1 | 180°' where sku = 'SS-000043';
update public.items set name = 'FICHA HEMBRA', attributes = '10 A' where sku = 'SS-000199';
update public.items set name = 'FICHA MACHO', attributes = '10 A' where sku = 'FICHA-MACHO--3498';
update public.items set name = 'FICHA MACHO', attributes = '20 A' where sku = 'FICHA-MACHO--1862';

-- GARRAFAS / GRAMPAS / INVERSORAS / MENSULAS
update public.items set name = 'GARRAFA', attributes = 'MAP PRO | 400 GR' where sku = 'SS-000026';
update public.items set name = 'GARRAFA', attributes = 'R32 | 3 KG' where sku = 'SS-000027';
update public.items set name = 'GARRAFA', attributes = '404A | 10.9 KG' where sku = 'SS-000028';
update public.items set name = 'GARRAFA', attributes = '410A | 11.3 KG' where sku = 'SS-000017';
update public.items set name = 'GARRAFA', attributes = 'MO49 | 13.6 KG' where sku = 'SS-000018';
update public.items set name = 'GARRAFA', attributes = 'R134A | 13.6 KG' where sku = 'SS-000019';
update public.items set name = 'GARRAFA', attributes = 'R22 | 13.6 KG' where sku = 'SS-000020';
update public.items set name = 'GARRAFA', attributes = 'R410 | 13.6 KG' where sku = 'GARRAFA-X-13-5329';
update public.items set name = 'GARRAFA', attributes = '410A | 5 KG' where sku = 'SS-000021';
update public.items set name = 'GARRAFA', attributes = 'R410 | 5 KG' where sku = 'GARRAFA-X-5--0448';
update public.items set name = 'GRAMPA OMEGA', attributes = '1/2' where sku = 'SS-000045';
update public.items set name = 'GRAMPA OMEGA', attributes = '3/4' where sku = 'SS-000046';
update public.items set name = 'INVERSORA 4 VIAS', attributes = '1/2 - 5/8' where sku = 'SS-000119';
update public.items set name = 'INVERSORA 4 VIAS', attributes = '3/8 - 1/2' where sku = 'SS-000120';
update public.items set name = 'INVERSORA 4 VIAS', attributes = '3/8 - 5/8' where sku = 'SS-000121';
update public.items set name = 'INVERSORA 4 VIAS', attributes = '5/16 - 3/8' where sku = 'SS-000122';
update public.items set name = 'JUEGO DE MENSULA', attributes = '420 MM' where sku = 'SS-000289';
update public.items set name = 'JUEGO DE MENSULA', attributes = '520 MM' where sku = 'SS-000290';
update public.items set name = 'JUEGO DE MENSULA', attributes = '620 MM' where sku = 'SS-000291';

-- LIMPIEZA DE PREFIJOS ARRASTRADOS EN ATTRIBUTES
update public.items set attributes = trim(replace(attributes, 'CODO COBRE ', ''))
where name = 'CODO COBRE' and attributes like 'CODO COBRE %';
update public.items set attributes = trim(replace(attributes, 'CURVA COBRE ', ''))
where name = 'CURVA COBRE' and attributes like 'CURVA COBRE %';
update public.items set attributes = trim(replace(attributes, 'CUPLA REDUCCION ', ''))
where name = 'CUPLA REDUCCION' and attributes like 'CUPLA REDUCCION %';
update public.items set attributes = trim(replace(attributes, 'CUPLA TRAFILADA ', ''))
where name = 'CUPLA TRAFILADA' and attributes like 'CUPLA TRAFILADA %';
update public.items set attributes = trim(replace(attributes, 'COMPRESOR ', ''))
where name = 'COMPRESOR' and attributes like 'COMPRESOR %';

-- MANUALIZACION GENERAL DE ATTRIBUTES EN ESTA TANDA
update public.items
set attributes = trim(regexp_replace(attributes, '\s+', ' ', 'g'))
where attributes is not null;

commit;
