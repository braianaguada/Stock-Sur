begin;

update public.items
set name = 'ACCESO',
    brand = null,
    model = null,
    attributes = 'PARA SOLDAR | CON CHICOTE'
where sku = 'SS-000056';

commit;
