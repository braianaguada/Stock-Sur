begin;

-- UNIONES
update public.items set name = 'UNION', attributes = 'CRISTAL' where sku = 'SS-000139';
update public.items
set name = 'UNION DE COBRE',
    attributes = trim(replace(name, 'UNION DE COBRE ', ''))
where name like 'UNION DE COBRE %';

-- ROBINETES
update public.items
set name = 'ROBINETE CURVA',
    attributes = trim(replace(name, 'ROBINETE CURVA ', ''))
where name like 'ROBINETE CURVA %';
update public.items
set name = 'ROBINETE RECTO',
    attributes = trim(replace(name, 'ROBINETE RECTO ', ''))
where name like 'ROBINETE RECTO %';
update public.items set name = 'ROBINETE', attributes = 'LATA | CON LLAVE' where sku = 'ROBINETE-PAR-1224';

-- PROTECTORES
update public.items
set name = 'PROTECTOR DE TENSION',
    attributes = trim(replace(name, 'PROTECTOR DE TENSION ', ''))
where name like 'PROTECTOR DE TENSION %';
update public.items
set name = 'PROTECTOR TERMICO CERAMICO',
    attributes = trim(replace(name, 'PROTECTOR TERMICO CERAMICO ', ''))
where name like 'PROTECTOR TERMICO CERAMICO %';
update public.items
set name = 'PROTECTOR TERMICO',
    attributes = trim(replace(name, 'PROTECTOR TERMICO ', ''))
where name like 'PROTECTOR TERMICO %'
  and name not like 'PROTECTOR TERMICO CERAMICO %';

-- LATAS
update public.items set name = 'LATA', attributes = 'R-32 | 0.65 KG' where sku = 'LATA-GAS-R-3-6164';
update public.items set name = 'LATA', attributes = 'R410 | 0.650 KG' where sku = 'SS-000029';
update public.items set name = 'LATA', attributes = '404A | 0.42 KG | HP62' where sku = 'SS-000030';
update public.items set name = 'LATA', attributes = '134A | 0.75 KG' where sku = 'SS-000031';
update public.items set name = 'LATA', attributes = 'MO49 | 0.75 KG' where sku = 'SS-000032';
update public.items set name = 'LATA', attributes = '134A | 1 KG' where sku in ('SS-000033', 'LATA-X-1-KG--3460');
update public.items set name = 'LATA', attributes = '141B | 1 KG' where sku = 'SS-000034';
update public.items set name = 'LATA', attributes = 'R22 | 1 KG' where sku = 'SS-000035';
update public.items set name = 'LATA', attributes = 'GR134 | 750 GR' where sku = 'LATA-X-750-G-0116';

-- RELAY / TERMINALES
update public.items
set name = 'RELAY',
    attributes = trim(regexp_replace(replace(replace(name, 'C/TERMICO', 'CON TERMICO'), 'T/COMPELA', 'T/COMPELA'), '^RELAY\\s*', ''))
where name like 'RELAY %';
update public.items
set attributes = trim(replace(attributes, 'RELAY ', ''))
where name = 'RELAY' and attributes like 'RELAY %';
update public.items
set name = case
      when name like 'TERMINAL BANDERITA %' then 'TERMINAL BANDERITA'
      when name like 'TERMINAL CILINDRICO%' then 'TERMINAL CILINDRICO'
      when name like 'TERMINAL DE CU ESTAÑO OJAS %' then 'TERMINAL DE CU ESTAÑO OJAS'
      when name like 'TERMINAL HORQUILLA ESTAÑADO %' then 'TERMINAL HORQUILLA'
      when name like 'TERMINAL HORQUILLA %' then 'TERMINAL HORQUILLA'
      when name like 'TERMINAL OJAL %' then 'TERMINAL OJAL'
      when name like 'TERMINAL PALA HEMBRA %' then 'TERMINAL PALA HEMBRA'
      when name like 'TERMINAL PALA MACHO%' then 'TERMINAL PALA MACHO'
      else name
    end,
    attributes = case
      when name like 'TERMINAL BANDERITA %' then trim(replace(name, 'TERMINAL BANDERITA ', ''))
      when name like 'TERMINAL CILINDRICO DE %' then trim(replace(name, 'TERMINAL CILINDRICO DE ', ''))
      when name like 'TERMINAL CILINDRICO %' then trim(replace(name, 'TERMINAL CILINDRICO ', ''))
      when name like 'TERMINAL DE CU ESTAÑO OJAS %' then trim(replace(name, 'TERMINAL DE CU ESTAÑO OJAS ', ''))
      when name like 'TERMINAL HORQUILLA ESTAÑADO %' then 'ESTAÑADO | ' || trim(replace(name, 'TERMINAL HORQUILLA ESTAÑADO ', ''))
      when name like 'TERMINAL HORQUILLA %' then trim(replace(name, 'TERMINAL HORQUILLA ', ''))
      when name like 'TERMINAL OJAL %' then trim(replace(name, 'TERMINAL OJAL ', ''))
      when name like 'TERMINAL PALA HEMBRA %' then trim(replace(name, 'TERMINAL PALA HEMBRA ', ''))
      when name like 'TERMINAL PALA MACHO LATON' then 'LATON'
      else attributes
    end
where name like 'TERMINAL %';

-- PRESOSTATOS / SENSORES
update public.items
set name = 'PRESOSTATO',
    attributes = trim(replace(name, 'PRESOSTATO ', ''))
where name like 'PRESOSTATO %'
  and name not in ('PRESOSTATO', 'PRESOSTATO ENCAPSULADO');
update public.items
set name = 'SENSOR DE TEMPERATURA NO FROST',
    attributes = trim(replace(name, 'SENSOR DE TEMPERATURA NO FROST ', ''))
where name like 'SENSOR DE TEMPERATURA NO FROST %';
update public.items
set name = 'SENSOR EVAPORADORA + AMBIENTE',
    attributes = trim(replace(name, 'SENSOR EVAPORADORA + AMBIENTE ', ''))
where name like 'SENSOR EVAPORADORA + AMBIENTE %';

update public.items
set attributes = trim(regexp_replace(attributes, '\s+', ' ', 'g'))
where attributes is not null;

commit;
