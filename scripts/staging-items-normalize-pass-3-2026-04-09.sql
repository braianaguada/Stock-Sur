begin;

-- Filtros: keep the commercial description and move the exact code to model only.
update public.items
set name = 'FILTRO 1 1/8 SAE'
where sku in ('FILTRO-ALCO--0955', 'FILTRO-BLUES-0619');

update public.items
set name = 'FILTRO 5/8 SAE'
where sku in ('FILTRO-ALCO--1900', 'FILTRO-ALCO--2075');

update public.items
set name = 'FILTRO 5/8 ODF'
where sku = 'FILTRO-ALCO--5923';

update public.items
set name = 'FILTRO 7/8 ODF'
where sku = 'FILTRO-DANFO-2130';

update public.items
set name = 'FILTRO 1/2 FLARE'
where sku = 'FILTRO-DANFO-3793';

update public.items
set name = 'FILTRO 3 3/4 ODF'
where sku = 'FILTRO-FAI-C-2363';

update public.items
set name = 'FILTRO 2.5 5/8 ODF'
where sku = 'FILTRO-FAI-C-5082';

update public.items
set name = 'FILTRO 3 3/4 FLARE'
where sku = 'FILTRO-FAI-C-5740';

update public.items
set name = 'FILTRO 2.5 5/8 FLARE'
where sku = 'FILTRO-FAI-C-7587';

update public.items
set name = 'FILTRO 3 7/8 ODF'
where sku = 'FILTRO-FAI-C-7611';

update public.items
set name = 'FILTRO 2.5 3/4 ODF'
where sku = 'FILTRO-FAI-C-7803';

update public.items
set name = 'FILTRO J/B 1/2 SAE-FLARE'
where sku = 'FILTRO-J-B-S-2003';

update public.items
set name = 'FILTRO J/B 5/8 SAE'
where sku = 'FILTRO-J-B-S-3843';

update public.items
set name = 'FILTRO J/B 1/2 SAE'
where sku = 'FILTRO-J-B-S-7619';

update public.items
set name = 'FILTRO J/B 5/8 SAE- FLARE'
where sku = 'FILTRO-J-B-S-8243';

update public.items
set name = 'FILTRO 3/8 FLARE'
where sku in ('FILTRO-MGL-0-0294', 'FILTRO-MGL-1-6019');

update public.items
set name = 'FILTRO 1/4 FLARE'
where sku in ('FILTRO-MGL-0-1022', 'FILTRO-MGL-0-2813', 'FILTRO-MGL-0-4204');

update public.items
set name = 'FILTRO 1/4 ODF'
where sku = 'FILTRO-MGL-0-2083';

update public.items
set name = 'FILTRO 1/4 SAE'
where sku in ('FILTRO-MGL-0-2908', 'FILTRO-MGL-0-3003', 'FILTRO-MGL-0-9509');

update public.items
set name = 'FILTRO 3/8 SAE'
where sku in ('FILTRO-MGL-0-4309', 'FILTRO-MGL-1-9507');

update public.items
set name = 'FILTRO 1/2 SAE'
where sku in ('FILTRO-MGL-1-4076', 'FILTRO-MGL-1-5460');

update public.items
set name = 'FILTRO 1/2 ODF'
where sku = 'FILTRO-MGL-1-9404';

-- Forzadores and nearby rotating parts.
update public.items
set name = 'AXIAL FAN MOTOR'
where sku = 'AXIAL-FAN-MO-4305';

update public.items
set name = 'FORZADOR BALL'
where sku in ('FORZADOR-LIO-4839', 'SS-000200', 'SS-000201', 'SS-000202', 'SS-000203');

update public.items
set name = 'TURBINA TANGENCIAL 18CM'
where sku = 'SS-000211';

-- Herramientas: keep the commercial description and remove the model from name.
update public.items
set name = 'ALICATE'
where sku = 'ALICATE-PROS-9060';

update public.items
set name = 'CORTADORA CAÑO MEDIANA'
where sku = 'CORTADORA-CA-2673';

update public.items
set name = 'CORTADORA DE CAÑO'
where sku in ('CORTADORA-DE-2037', 'CORTADORA-DE-3818');

update public.items
set name = 'DETECTOR DE FUGAS'
where sku = 'DETECTOR-DE--2873';

update public.items
set name = 'ESCARIADOR'
where sku = 'ESCARIADOR-L-5117';

update public.items
set name = 'EXPANSOR MULTIPLE'
where sku = 'EXPANSOR-MUL-7467';

update public.items
set name = 'KIT HERRAMIENTAS DE EXPANSION'
where sku = 'KIT-HERRAMIE-6096';

update public.items
set name = 'MULTIMETRO DIGITAL'
where sku = 'MULTIMETRO-D-1471';

update public.items
set name = 'PEINE'
where sku = 'PEINE-ELITEC-8461';

update public.items
set name = 'PEINE ESTRELLA'
where sku = 'PEINE-ESTREL-1093';

update public.items
set name = 'PINZA DE FUERZA 7"'
where sku = 'PINZA-DE-FUE-0261';

update public.items
set name = 'PINZA UNIVERSAL'
where sku = 'PINZA-UNIVER-1716';

update public.items
set name = 'RELOJ MANIFOLD'
where sku in ('RELOJ-MANIFO-2862', 'RELOJ-MANIFO-5774');

update public.items
set name = 'DETECTOR DE FUGA'
where sku = 'SS-000025';

update public.items
set name = 'DOBLADORA DE CAÑO 3 EN 1 A 180º'
where sku = 'SS-000043';

update public.items
set name = 'CORTADORA CAÑO MINI'
where sku = 'SS-000059';

update public.items
set name = 'DESOLDADOR A PISTON'
where sku = 'SS-000060';

update public.items
set name = 'PINZA CORTA CAPILAR'
where sku = 'SS-000064';

update public.items
set name = 'PUNZON AGRANDA CAÑO 3/16 A 5/8'
where sku = 'SS-000066';

update public.items
set name = 'TERMOMETRO DIGITAL S/PILAS'
where sku = 'SS-000067';

update public.items
set name = 'TERMOMETRO DIGITAL PARA PANEL'
where sku = 'SS-000301';

-- Other remaining safe cases.
update public.items
set name = 'CELDA PELTIER 30MM X 30MM 12V'
where sku = 'SS-000240';

update public.items
set name = 'CELDA PELTIER 40MM X 40MM 12V'
where sku in ('SS-000241', 'SS-000242', 'SS-000243');

update public.items
set name = 'TRANSF. 220/24/100V. TB COSMOS'
where sku = 'SS-000310';

update public.items
set name = 'TRANSF. 220/24/50V. TB COSMOS'
where sku = 'SS-000311';

update public.items
set name = 'CAJA P/TERMOSTATO GRANDE'
where sku = 'SS-000218';

update public.items
set name = 'TIMER UNIVERSAL AJUSTABLE DEFROST'
where sku = 'SS-000068';

update public.items
set name = 'TIMER 6HS 21MIN DEFROST 220V'
where sku = 'SS-000309';

update public.items
set name = 'VALVULA REG.NITROGENO LIGA'
where sku = 'SS-000055';

commit;
