begin;

-- Normalize obvious unit mismatches.
update public.items
set unit = 'm'
where sku in ('SS-000265', 'SS-000266', 'SS-000267', 'SS-000268')
  and unit <> 'm';

update public.items
set unit = 'un'
where sku = 'QA-MULTI-SEC'
  and unit <> 'un';

-- Separate brand/model from names where the split is deterministic.
update public.items
set
  brand = 'DIXELL',
  name = 'COMBISTATO 2 SONDAS'
where sku = 'SS-000294';

update public.items
set
  brand = 'LONG TERM',
  name = 'COMBISTATO 2 SONDAS'
where sku = 'SS-000295';

update public.items
set name = 'COMBISTATO'
where sku in ('COMBISTATO-S-4737', 'COMBISTATO-S-7713', 'COMBISTATO-S-8568', 'COMBISTATO-W-8160');

update public.items
set name = 'PLACA UNIVERSAL A/A'
where sku in ('PLACA-UNIVER-1478', 'PLACA-UNIVER-1686', 'PLACA-UNIVER-6870', 'PLACA-UNIVER-6878');

update public.items
set name = 'BOBINA P/CONTACTOR'
where sku = 'BOBINA-P-CON-3192';

update public.items
set name = 'BOBINA P/ CONTACTOR'
where sku = 'BOBINA-P-CON-7695';

update public.items
set name = 'CONTACTOR'
where sku = 'CONTACTOR-LC-1951';

update public.items
set
  name = trim(
    regexp_replace(
      regexp_replace(name, '\s*-?C?C?BB60\s*$', '', 'i'),
      '\s{2,}',
      ' ',
      'g'
    )
  )
where model = 'CBB60'
  and upper(name) like 'CAPACITOR%';

update public.items
set name = 'PRESOSTATO ENCAPSULADO RESET MANUAL'
where upper(name) like 'PRESOSTATO ENCAPSULADO RESET MANUAL %'
  and model is not null
  and btrim(model) <> '';

update public.items
set name = 'PRESOSTATO ENCAPSULADO'
where upper(name) like 'PRESOSTATO ENCAPSULADO %'
  and upper(name) not like 'PRESOSTATO ENCAPSULADO RESET MANUAL %'
  and model is not null
  and btrim(model) <> '';

update public.items
set name = 'PRESOSTATO 1/4 FLARE'
where sku in ('PRESOSTATO-H-2196', 'PRESOSTATO-H-4548', 'PRESOSTATO-H-5528');

update public.items
set name = 'PRESOSTATO HM 1/4 FLARE'
where sku = 'PRESOSTATO-H-4424';

update public.items
set brand = 'ROBERTSHAW'
where brand is null
  and (
    upper(name) like 'TERMOSTATO RC %'
    or upper(name) like 'TERMOSTATO RC%'
  );

update public.items
set name = 'TERMOSTATO BULBO CORTO'
where sku = 'SS-000302';

update public.items
set name = 'TERMOSTATO BULBO LARGO'
where sku = 'SS-000303';

update public.items
set name = 'TERMOSTATO'
where sku in ('SS-000307', 'SS-000308', 'SS-000326', 'TERMOSTATO-K-3598');

update public.items
set name = 'TERMOSTATO RFR'
where sku = 'TERMOSTATO-R-0837';

update public.items
set name = 'TERMOSTATO'
where sku in (
  'TERMOSTATO-R-0036',
  'TERMOSTATO-R-0263',
  'TERMOSTATO-R-0725',
  'TERMOSTATO-R-0758',
  'TERMOSTATO-R-1262',
  'TERMOSTATO-R-3133',
  'TERMOSTATO-R-3253',
  'TERMOSTATO-R-3997',
  'TERMOSTATO-R-4206',
  'TERMOSTATO-R-5261',
  'TERMOSTATO-R-5557',
  'TERMOSTATO-R-5685',
  'TERMOSTATO-R-8518',
  'TERMOSTATO-R-8524',
  'TERMOSTATO-R-9310',
  'TERMOSTATO-R-9438',
  'TERMOSTATO-R-9638',
  'TERMOSTATO-R-9870'
);

update public.items
set name = 'TERMOSTATO GAFA'
where sku = 'SS-000305';

update public.items
set name = 'TERMOSTATO COVENTRY'
where sku = 'SS-000306';

update public.items
set name = 'TERMOSTATO MULTIBRS'
where sku = 'SS-000312';

update public.items
set name = 'TERMOSTATO TF8-101'
where sku = 'SS-000313';

update public.items
set name = 'TERMOSTATO ELECTRLX'
where sku = 'SS-000314';

update public.items
set name = 'TERMOSTATO ADZEN'
where sku = 'SS-000315';

update public.items
set name = 'TERMOSTATO TF7AURO'
where sku = 'SS-000316';

update public.items
set name = 'TERMOSTATO PHILIPSC/T'
where sku = 'SS-000317';

update public.items
set name = 'TERMOSTATO FRIG.N / FROST'
where sku = 'SS-000318';

update public.items
set name = 'TERMOSTATO FS/AUTM'
where sku = 'SS-000319';

update public.items
set name = 'TERMOSTATO M/TEMPTRIA'
where sku = 'SS-000320';

update public.items
set name = 'TERMOSTATO ENF.LIQ.'
where sku = 'SS-000321';

update public.items
set name = 'TERMOSTATO BRASTEM'
where sku = 'SS-000322';

update public.items
set name = 'TERMOSTATO AURORA'
where sku = 'SS-000323';

update public.items
set name = 'TERMOSTATO BRASTEMP'
where sku = 'SS-000324';

update public.items
set name = 'TERMOSTATO WHIRPOOL'
where sku = 'SS-000325';

commit;
