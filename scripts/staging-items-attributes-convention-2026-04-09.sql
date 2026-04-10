begin;

alter table public.items
  add column if not exists attributes text;

-- CABLE
update public.items
set
  name = 'CABLE',
  brand = 'TPR',
  attributes = case sku
    when 'SS-000265' then '3 x 1.5 MM'
    when 'SS-000266' then '3 x 2.5 MM'
    when 'SS-000267' then '5 x 1.5 MM'
    when 'SS-000268' then '5 x 2.5 MM'
    else attributes
  end
where sku in ('SS-000265', 'SS-000266', 'SS-000267', 'SS-000268');

-- CABLECANAL
update public.items
set
  name = 'CABLECANAL',
  attributes = case sku
    when 'SS-000269' then '100 x 50 MM x 2 M'
    when 'SS-000270' then '18 x 21 MM x 2 M | CON ADHESIVO'
    when 'SS-000271' then '20 x 10 MM x 2 M | CON ADHESIVO'
    else attributes
  end
where sku in ('SS-000269', 'SS-000270', 'SS-000271');

-- FORZADOR
update public.items
set
  name = 'FORZADOR',
  brand = 'LIONBALL',
  attributes = null
where sku in ('FORZADOR-LIO-4839', 'SS-000200', 'SS-000201', 'SS-000202', 'SS-000203');

update public.items
set
  name = 'FORZADOR',
  attributes = case sku
    when 'SS-000282' then 'ASPIRANTE | 300 MM | 220 V'
    when 'SS-000283' then 'ASPIRANTE | 350 MM | 220 V'
    when 'SS-000284' then 'ASPIRANTE | 400 MM | 220 V'
    when 'SS-000285' then 'ASPIRANTE | 500 MM | 380 V'
    when 'SS-000286' then 'ASPIRANTE | 630 MM | 380 V'
    when 'SS-000287' then 'SOPLANTE | 300 MM | 220 V'
    when 'SS-000288' then 'SOPLANTE | 350 MM | 220 V'
    when 'FORZADOR-NO--4334' then 'NO FROST'
    when 'FORZADOR-NO--6245' then 'NO FROST'
    when 'SS-000204' then 'PACO ANCHO'
    when 'SS-000205' then 'PACO FINO'
    else attributes
  end
where sku in (
  'SS-000282', 'SS-000283', 'SS-000284', 'SS-000285', 'SS-000286',
  'SS-000287', 'SS-000288', 'FORZADOR-NO--4334', 'FORZADOR-NO--6245',
  'SS-000204', 'SS-000205'
);

-- CAPACITOR
update public.items
set
  name = 'CAPACITOR',
  brand = 'MG',
  model = coalesce(model, 'CBB60'),
  attributes = case sku
    when 'SS-000219' then '450 VAC | 50/60 HZ | 10 UF'
    when 'CAPACITOR-MG-6772' then '450 VAC | 50/60 HZ | 35 UF'
    when 'CAPACITOR-MG-5629' then '450 VAC | 50/60 HZ | 4 UF'
    when 'SS-000221' then '450 VAC | 50/60 HZ | 2 UF'
    when 'SS-000222' then '450 VAC | 50/60 HZ | 3 UF'
    when 'SS-000223' then '450 VAC | 50/60 HZ | 5 UF'
    when 'SS-000224' then '450 VAC | 50/60 HZ | 6 UF'
    when 'SS-000225' then '450 VAC | 50/60 HZ | 8 UF'
    when 'SS-000226' then '450 VAC | 50/60 HZ | 1.5 UF'
    when 'SS-000227' then '450 VAC | 50/60 HZ | 12.5 UF'
    when 'CAPACITOR-MG-8856' then '450 VAC | 50/60 HZ | 14 UF'
    when 'SS-000228' then '450 VAC | 50/60 HZ | 16 UF'
    when 'CAPACITOR-MG-9071' then '450 VAC | 50/60 HZ | 18 UF'
    when 'SS-000229' then '450 VAC | 50/60 HZ | 2.5 UF'
    when 'SS-000230' then '450 VAC | 50/60 HZ | 20 UF'
    when 'SS-000231' then '450 VAC | 50/60 HZ | 22 UF'
    when 'SS-000232' then '450 VAC | 50/60 HZ | 25 UF'
    when 'SS-000233' then '450 VAC | 50/60 HZ | 27 UF'
    when 'SS-000220' then '450 VAC | 50/60 HZ | 30 UF'
    when 'CAPACITOR-MG-4961' then '450 VAC | 50/60 HZ | 30 UF'
    when 'CAPACITOR-MG-4183' then '450 VAC | 50/60 HZ | 32 UF'
    when 'SS-000234' then '450 VAC | 50/60 HZ | 35 UF'
    when 'SS-000235' then '450 VAC | 50/60 HZ | 40 UF'
    when 'SS-000236' then '450 VAC | 50/60 HZ | 45 UF'
    when 'CAPACITOR-MG-5679' then '450 VAC | 50/60 HZ | 4 UF'
    when 'SS-000237' then '450 VAC | 50/60 HZ | 50 UF'
    when 'SS-000238' then '450 VAC | 50/60 HZ | 60 UF'
    when 'SS-000239' then '450 VAC | 50/60 HZ | 65 UF'
    else attributes
  end
where sku in (
  'SS-000219', 'CAPACITOR-MG-6772', 'CAPACITOR-MG-5629', 'SS-000221', 'SS-000222', 'SS-000223',
  'SS-000224', 'SS-000225', 'SS-000226', 'SS-000227', 'CAPACITOR-MG-8856', 'SS-000228',
  'CAPACITOR-MG-9071', 'SS-000229', 'SS-000230', 'SS-000231', 'SS-000232', 'SS-000233',
  'SS-000220', 'CAPACITOR-MG-4961', 'CAPACITOR-MG-4183', 'SS-000234', 'SS-000235', 'SS-000236',
  'CAPACITOR-MG-5679', 'SS-000237', 'SS-000238', 'SS-000239'
);

-- PLACA UNIVERSAL
update public.items
set
  name = 'PLACA UNIVERSAL',
  attributes = 'A/A'
where sku in ('PLACA-UNIVER-1478', 'PLACA-UNIVER-1686', 'PLACA-UNIVER-6870', 'PLACA-UNIVER-6878');

-- FILTRO
update public.items
set
  name = 'FILTRO',
  attributes = case sku
    when 'FILTRO-ALCO--0955' then '1 1/8 SAE'
    when 'FILTRO-BLUES-0619' then '1 1/8 SAE'
    when 'FILTRO-DANFO-3793' then '1/2 FLARE'
    when 'FILTRO-MGL-1-9404' then '1/2 ODF'
    when 'FILTRO-MGL-1-4076' then '1/2 SAE'
    when 'FILTRO-MGL-1-5460' then '1/2 SAE'
    when 'FILTRO-MGL-0-1022' then '1/4 FLARE'
    when 'FILTRO-MGL-0-2813' then '1/4 FLARE'
    when 'FILTRO-MGL-0-4204' then '1/4 FLARE'
    when 'FILTRO-MGL-0-2083' then '1/4 ODF'
    when 'FILTRO-MGL-0-2908' then '1/4 SAE'
    when 'FILTRO-MGL-0-3003' then '1/4 SAE'
    when 'FILTRO-MGL-0-9509' then '1/4 SAE'
    when 'FILTRO-FAI-C-7803' then '2.5 | 3/4 ODF'
    when 'FILTRO-FAI-C-7587' then '2.5 | 5/8 FLARE'
    when 'FILTRO-FAI-C-5082' then '2.5 | 5/8 ODF'
    when 'FILTRO-FAI-C-5740' then '3 | 3/4 FLARE'
    when 'FILTRO-FAI-C-2363' then '3 | 3/4 ODF'
    when 'FILTRO-FAI-C-7611' then '3 | 7/8 ODF'
    when 'FILTRO-MGL-0-0294' then '3/8 FLARE'
    when 'FILTRO-MGL-1-6019' then '3/8 FLARE'
    when 'FILTRO-MGL-0-4309' then '3/8 SAE'
    when 'FILTRO-MGL-1-9507' then '3/8 SAE'
    when 'FILTRO-ALCO--5923' then '5/8 ODF'
    when 'FILTRO-ALCO--1900' then '5/8 SAE'
    when 'FILTRO-ALCO--2075' then '5/8 SAE'
    when 'FILTRO-DANFO-2130' then '7/8 ODF'
    when 'FILTRO-J-B-S-7619' then '1/2 SAE'
    when 'FILTRO-J-B-S-2003' then '1/2 SAE | FLARE'
    when 'FILTRO-J-B-S-3843' then '5/8 SAE'
    when 'FILTRO-J-B-S-8243' then '5/8 SAE | FLARE'
    when 'SS-000112' then 'COBRE | 2 SALIDAS | PARA AIRE ACOND'
    when 'SS-000113' then '10 GR | CON CHICOTE'
    when 'SS-000114' then '15 GR | CON CHICOTE'
    when 'FILTRO-MOLEC-6455' then '15 GR | SIN CHICOTE'
    when 'SS-000115' then '20 GR | CON CHICOTE'
    when 'SS-000116' then '30 GR | CON CHICOTE'
    when 'SS-000272' then '400 x 400 x 50'
    when 'SS-000273' then '500 x 400 x 25'
    when 'SS-000274' then '500 x 400 x 50'
    when 'SS-000275' then '500 x 500 x 25'
    when 'SS-000276' then '500 x 500 x 50'
    when 'SS-000277' then '600 x 400 x 50'
    when 'SS-000278' then '600 x 500 x 25'
    when 'SS-000279' then '600 x 500 x 50'
    when 'SS-000280' then '600 x 600 x 25'
    when 'SS-000281' then '600 x 600 x 50'
    when 'FILTRO-DESCA-1561' then '60 x 70 x 25 CM'
    when 'FILTRO-AIRE--2713' then '60 x 70 x 50 CM'
    else attributes
  end
where sku in (
  'FILTRO-ALCO--0955', 'FILTRO-BLUES-0619', 'FILTRO-DANFO-3793', 'FILTRO-MGL-1-9404', 'FILTRO-MGL-1-4076',
  'FILTRO-MGL-1-5460', 'FILTRO-MGL-0-1022', 'FILTRO-MGL-0-2813', 'FILTRO-MGL-0-4204', 'FILTRO-MGL-0-2083',
  'FILTRO-MGL-0-2908', 'FILTRO-MGL-0-3003', 'FILTRO-MGL-0-9509', 'FILTRO-FAI-C-7803', 'FILTRO-FAI-C-7587',
  'FILTRO-FAI-C-5082', 'FILTRO-FAI-C-5740', 'FILTRO-FAI-C-2363', 'FILTRO-FAI-C-7611', 'FILTRO-MGL-0-0294',
  'FILTRO-MGL-1-6019', 'FILTRO-MGL-0-4309', 'FILTRO-MGL-1-9507', 'FILTRO-ALCO--5923', 'FILTRO-ALCO--1900',
  'FILTRO-ALCO--2075', 'FILTRO-DANFO-2130', 'FILTRO-J-B-S-7619', 'FILTRO-J-B-S-2003', 'FILTRO-J-B-S-3843',
  'FILTRO-J-B-S-8243', 'SS-000112', 'SS-000113', 'SS-000114', 'FILTRO-MOLEC-6455', 'SS-000115', 'SS-000116',
  'SS-000272', 'SS-000273', 'SS-000274', 'SS-000275', 'SS-000276', 'SS-000277', 'SS-000278', 'SS-000279',
  'SS-000280', 'SS-000281', 'FILTRO-DESCA-1561', 'FILTRO-AIRE--2713'
);

-- TERMOSTATO
update public.items
set
  name = 'TERMOSTATO',
  attributes = case sku
    when 'SS-000302' then 'BULBO CORTO'
    when 'SS-000303' then 'BULBO LARGO'
    when 'SS-000305' then 'GAFA'
    when 'SS-000306' then 'COVENTRY'
    when 'SS-000312' then 'MULTIBRS'
    when 'SS-000313' then 'TF8-101'
    when 'SS-000314' then 'ELECTRLX'
    when 'SS-000315' then 'ADZEN'
    when 'SS-000316' then 'TF7AURO'
    when 'SS-000317' then 'PHILIPSC/T'
    when 'SS-000318' then 'FRIG.N / FROST'
    when 'SS-000319' then 'FS/AUTM'
    when 'SS-000320' then 'M/TEMPTRIA'
    when 'SS-000321' then 'ENF.LIQ.'
    when 'SS-000322' then 'BRASTEM'
    when 'SS-000323' then 'AURORA'
    when 'SS-000324' then 'BRASTEMP'
    when 'SS-000325' then 'WHIRPOOL'
    when 'TERMOSTATO-H-8469' then 'VISION PRO 8000 | R1008'
    when 'TERMOSTATO-D-3200' then 'AMBIENTE DIGITAL | 26001'
    when 'SS-000304' then 'IMIT | TA3 | 220 V'
    else attributes
  end
where (
  upper(name) like 'TERMOSTATO%'
  or sku in (
    'SS-000302', 'SS-000303', 'SS-000304', 'SS-000305', 'SS-000306', 'SS-000307', 'SS-000308',
    'SS-000312', 'SS-000313', 'SS-000314', 'SS-000315', 'SS-000316', 'SS-000317', 'SS-000318',
    'SS-000319', 'SS-000320', 'SS-000321', 'SS-000322', 'SS-000323', 'SS-000324', 'SS-000325',
    'SS-000326', 'TERMOSTATO-K-3598', 'TERMOSTATO-R-0036', 'TERMOSTATO-R-0263', 'TERMOSTATO-R-0725',
    'TERMOSTATO-R-0758', 'TERMOSTATO-R-0837', 'TERMOSTATO-R-1262', 'TERMOSTATO-R-3133', 'TERMOSTATO-R-3253',
    'TERMOSTATO-R-3997', 'TERMOSTATO-R-4206', 'TERMOSTATO-R-5261', 'TERMOSTATO-R-5557', 'TERMOSTATO-R-5685',
    'TERMOSTATO-R-8518', 'TERMOSTATO-R-8524', 'TERMOSTATO-R-9310', 'TERMOSTATO-R-9438', 'TERMOSTATO-R-9638',
    'TERMOSTATO-R-9870', 'TERMOSTATO-H-8469', 'TERMOSTATO-D-3200'
  )
);

update public.items
set brand = 'IMIT'
where sku = 'SS-000304';

commit;
