begin;

-- CONTACTORES / CONTROLES
update public.items
set name = 'CONTACTOR AUXILIAR',
    brand = 'DILETTA',
    attributes = '75111'
where sku = 'CONTACTOR-AU-5181';

update public.items
set name = 'CONTACTOR AUXILIAR',
    brand = 'SCHNEIDER',
    attributes = 'TESYS | 3 POLOS | 9 A | 24 V'
where sku = 'CONTACTOR-AU-8069';

update public.items
set name = 'CONTROL REMOTO UNIVERSAL',
    attributes = '1000 EN 1'
where sku = 'SS-000058';

-- ELECTRICOS / QUIMICOS / ACCESORIOS
update public.items set name = 'DISYUNTOR UNIPOLAR', brand = 'STECK', attributes = '40 A' where sku = 'SS-000198';
update public.items set name = 'FLUIDO DESHIDRATANTE', attributes = '65 CC' where sku = 'SS-000117';
update public.items set name = 'FUNDENTE', brand = 'HARRIS', attributes = 'SUPERFLUX | 3 x 80 GR' where sku = 'SS-000044';
update public.items set name = 'FUSIBLES', attributes = '5 AMP' where sku = 'SS-000244';
update public.items set name = 'GOMA', attributes = 'MANOMETRO' where sku = 'SS-000118';
update public.items set name = 'JUEGO DE PERILLAS', attributes = 'MANIFOLD' where sku = 'SS-000123';
update public.items set name = 'JUEGO MANGUERA', brand = 'DSZH', attributes = 'R410A | 1.8 M' where sku = 'JUEGO-MANGUE-8468';
update public.items set name = 'JUEGO TACOS DE GOMA', attributes = 'CON TORNILLO | 4 UNI' where sku = 'SS-000124';
update public.items set name = 'KIT ARRANQUE PESADO', attributes = '300% | HS5' where sku = 'KIT-ARRANQUE-7763';
update public.items set name = 'KIT DE TORNILLOS', attributes = 'CONJUNTO N°11 | HUECO' where sku = 'SS-000125';
update public.items set name = 'LIQUIDO DESINCRUSTANTE', attributes = '5 L' where sku = 'SS-000022';

-- HERRAMIENTAS Y MANGUERAS
update public.items set name = 'LLAVE CRIQUET', model = 'LT122', attributes = null where sku = 'LLAVE-CRIQUE-1989';
update public.items set name = 'LLAVE CRIQUET', model = 'LT123', attributes = null where sku = 'LLAVE-CRIQUE-6181';
update public.items set name = 'LLAVE PINCHE', attributes = '1/4 - 5/16 - 3/8 | CON ALLEN' where sku = 'SS-000126';
update public.items set name = 'MANGUERA CRISTAL', attributes = '1/2 x 1 M' where sku = 'SS-000292';
update public.items set name = 'MANGUERA CRISTAL', attributes = '5/8 x 1 M' where sku = 'SS-000293';
update public.items set name = 'MANIFOLD', attributes = 'R20/R134 | BLISTER' where sku = 'SS-000050';
update public.items set name = 'MECHERO', attributes = 'CALEFACTOR CENTRAL' where sku = 'SS-000296';
update public.items set name = 'MENSULA', attributes = '80 CM' where sku = 'MENSULA-80CM-5794';
update public.items set name = 'PALA', attributes = 'FORZADOR | Ø200 MM' where sku = 'SS-000127';
update public.items set name = 'PALA', attributes = 'FORZADOR | Ø300 MM' where sku = 'SS-000128';
update public.items set name = 'PILA', brand = 'GOLDEN POWER', attributes = 'ALKALINE | 1.5 V' where sku = 'SS-000061';
update public.items set name = 'PINZA AMPEROMETRICA', attributes = 'CON CAPACIMETRO' where sku = 'SS-000037';
update public.items set name = 'PINZA DE FUERZA', attributes = '7"' where sku = 'PINZA-DE-FUE-0261';
update public.items set name = 'PROTECTOR DE TENSION', attributes = 'PR5 | 2500 W | 20 A' where sku = 'SS-000065';
update public.items set name = 'PUNZON AGRANDA CAÑO', attributes = '3/16 A 5/8' where sku = 'SS-000066';

-- REDUCCIONES / RELES / SELLADOR / SOPORTES
update public.items set name = 'REDUCCION COBRE', attributes = '1 3/8 x 1 1/8' where sku = 'SS-000166';
update public.items set name = 'REDUCCION COBRE', attributes = '2 5/8 x 1 3/8' where sku = 'SS-000167';
update public.items set name = 'REDUCCION COBRE', attributes = '3/4 x 5/8' where sku = 'SS-000168';
update public.items set name = 'REDUCCION COBRE', attributes = '5/8 x 1/2' where sku = 'SS-000169';
update public.items set name = 'REDUCCION COBRE', attributes = '7/8 x 3/4' where sku = 'SS-000170';
update public.items set name = 'RELE', brand = 'THOMELEC', attributes = '10 A | 220 V' where sku = 'RELE-THOMELEC-1187';
update public.items set name = 'RELE VOLTIMETRICO', attributes = '1/4-1/2 HP | 116' where sku = 'RELE-VOLTIME-7103';
update public.items set name = 'RELE VOLTIMETRICO', attributes = '1/4-1/2 HP | 118' where sku = 'RELE-VOLTIME-0287';
update public.items set name = 'RELE VOLTIMETRICO', attributes = '601' where sku = 'RELE-VOLTIME-4767';
update public.items set name = 'SELLA FUGAS', attributes = 'EXTREME HVACR | JERINGA | 12 ML' where sku = 'SS-000052';
update public.items set name = 'SOPLETE MANUAL', attributes = 'SIN MANGUERA | SIN CHISPA' where sku = 'SS-000039';
update public.items set name = 'SOPORTE', brand = 'SARSA', attributes = 'UNID COND SPLIT | 4 | BLANCO' where sku = 'SS-000053';
update public.items set name = 'TACO SOPORTE GOMA', attributes = 'AIRE ACOND | SIN TORNILLO' where sku = 'SS-000137';
update public.items set name = 'TAPA AGUJERO CAÑERIA', attributes = 'A/A | GRANDE' where sku = 'SS-000206';

-- TAPONES / TECLAS / TERMICAS / TERMOMETROS / TIMER
update public.items set name = 'TAPON BRONCE', attributes = '1/4' where sku = 'TAPON-BRONCE-1729';
update public.items set name = 'TAPON BRONCE', attributes = '5/16' where sku = 'TAPON-BRONCE-8659';
update public.items set name = 'TAPON', attributes = '1/2 | POLIPROPILENO' where sku = 'SS-000093';
update public.items set name = 'TAPON', attributes = '3/4 | POLIPROPILENO' where sku = 'SS-000094';
update public.items set name = 'TECLA ON/OFF', attributes = '10 A' where sku = 'TECLA-ON-OFF-2529';
update public.items set name = 'TECLA ON/OFF', attributes = '6 A' where sku = 'TECLA-ON-OFF-5018';
update public.items set name = 'TERMICA BIPOLAR', attributes = '2 x 10' where sku = 'TERMICA-BIPO-5990';
update public.items set name = 'TERMICA BIPOLAR', attributes = '2 x 15' where sku = 'SS-000207';
update public.items set name = 'TERMICA BIPOLAR', attributes = '2 x 20' where sku = 'SS-000208';
update public.items set name = 'TERMICA BIPOLAR', attributes = '2 x 25' where sku = 'TERMICA-BIPO-5383';
update public.items set name = 'TERMICA UNIPOLAR', attributes = '1 x 25 A' where sku = 'TERMICA-UNIP-0182';
update public.items set name = 'TERMOMETRO DIGITAL', attributes = 'PANEL' where sku = 'SS-000301';
update public.items set name = 'TERMOMETRO DIGITAL', attributes = 'PECERA | CON PILAS' where sku = 'TERMOMETRO-D-1414';
update public.items set name = 'TERMOMETRO DIGITAL', attributes = 'SIN PILAS' where sku = 'SS-000067';
update public.items set name = 'TIMER', attributes = '6 HS | 21 MIN | DEFROST | 220 V' where sku = 'SS-000309';

-- TOMAS / TRANSFORMADORES / TUBOS / TURBINAS
update public.items set name = 'TOMA', brand = 'MIG', attributes = '10 AMP | NORMALIZADO' where sku = 'SS-000209';
update public.items set name = 'TOMA', brand = 'MIG', attributes = '20 AMP | NORMALIZADO' where sku = 'SS-000210';
update public.items set name = 'TRANSF.', brand = 'COSMOS', attributes = '220/24/100 V | TB' where sku = 'SS-000310';
update public.items set name = 'TRANSF.', brand = 'COSMOS', attributes = '220/24/50 V | TB' where sku = 'SS-000311';
update public.items set name = 'TUBO DE ESTAÑO', attributes = '60% | 3 M' where sku = 'SS-000264';
update public.items set name = 'TUBO RECIBIDOR', attributes = '2 L' where sku = 'SS-000023';
update public.items set name = 'TURBINA TANGENCIAL', attributes = '18 CM' where sku = 'SS-000211';
update public.items set name = 'TURBINA TANGENCIAL', attributes = '24 CM' where sku = 'SS-000212';
update public.items set name = 'TURBINA TANGENCIAL', attributes = '36 CM | DOBLES' where sku = 'SS-000213';

-- UNIONES / VALVULAS / VARILLAS / VISOR
update public.items set name = 'UNION ENTREROSCA', attributes = '1/2 x 1/2' where sku = 'SS-000095';
update public.items set name = 'UNION ENTREROSCA', attributes = '1/2 x 1/4' where sku = 'SS-000096';
update public.items set name = 'UNION ENTREROSCA', attributes = '1/2 x 3/8' where sku = 'SS-000097';
update public.items set name = 'UNION ENTREROSCA', attributes = '1/4 x 1/4' where sku = 'SS-000098';
update public.items set name = 'UNION ENTREROSCA', attributes = '3/8 x 1/4' where sku = 'SS-000099';
update public.items set name = 'UNION ENTREROSCA', attributes = '3/8 x 3/8' where sku = 'SS-000100';
update public.items set name = 'UNION ENTREROSCA', attributes = '5/8 x 1/2' where sku = 'SS-000101';
update public.items set name = 'UNION ENTREROSCA', attributes = '5/8 x 5/8' where sku = 'SS-000102';
update public.items set name = 'UNION ENTREROSCA', attributes = 'BRONCE | 5/16 - 5/16' where sku = 'UNION-ENTRER-8727';
update public.items set name = 'UNION ENTREROSCA', attributes = 'BRONCE | 5/8 - 1/4' where sku = 'UNION-ENTRER-2079';
update public.items set name = 'UNION TEE COBRE', attributes = '1 3/8' where sku = 'SS-000181';
update public.items set name = 'UNION TEE COBRE', attributes = '1 5/8' where sku = 'SS-000182';
update public.items set name = 'UNION TEE COBRE', attributes = '1/2' where sku = 'SS-000183';
update public.items set name = 'UNION TEE COBRE', attributes = '1/4' where sku = 'SS-000184';
update public.items set name = 'UNION TEE COBRE', attributes = '2 5/8' where sku = 'SS-000185';
update public.items set name = 'UNION TEE COBRE', attributes = '3/4' where sku = 'SS-000186';
update public.items set name = 'UNION TEE COBRE', attributes = '3/8' where sku = 'SS-000187';
update public.items set name = 'UNION TEE COBRE', attributes = '5/8' where sku = 'SS-000188';
update public.items set name = 'UNION TEE COBRE', attributes = '7/8' where sku = 'SS-000189';
update public.items set name = 'VALVULA', attributes = 'LATA DESCART | CON ORING | OVULO' where sku = 'SS-000103';
update public.items set name = 'VARILLA', brand = 'HARRIS', attributes = 'PLATA 0%' where sku = 'VARILLA-HARR-2556';
update public.items set name = 'VISOR DE LIQUIDO', attributes = '1/2' where sku = 'SS-000214';
update public.items set name = 'VISOR DE LIQUIDO', attributes = '3/8' where sku = 'SS-000215';
update public.items set name = 'VISOR DE LIQUIDO', attributes = '5/8' where sku = 'SS-000216';

update public.items
set attributes = trim(regexp_replace(attributes, '\s+', ' ', 'g'))
where attributes is not null;

commit;
