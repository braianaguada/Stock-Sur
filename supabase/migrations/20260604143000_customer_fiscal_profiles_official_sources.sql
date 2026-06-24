alter table public.customer_fiscal_profiles
  add column if not exists taxpayer_status text null,
  add column if not exists tax_condition_source text null,
  add column if not exists legal_name_source text null;

update public.customer_fiscal_profiles
set validation_status = 'VALIDATED_AUTO'
where validation_status = 'VALIDATED';

update public.customer_fiscal_profiles
set
  validation_status = 'PENDING',
  validation_error = coalesce(validation_error, 'Perfil fiscal manual deshabilitado: requiere validacion automatica oficial.')
where validation_status = 'MANUAL_REVIEW';

update public.customer_fiscal_profiles
set tax_condition = case
  when upper(coalesce(tax_condition, '')) in ('RESPONSABLE_INSCRIPTO', 'RESPONSABLE INSCRIPTO', 'IVA RESPONSABLE INSCRIPTO') then 'RESPONSABLE_INSCRIPTO'
  when upper(coalesce(tax_condition, '')) in ('MONOTRIBUTO', 'MONOTRIBUTISTA') then 'MONOTRIBUTO'
  when upper(coalesce(tax_condition, '')) in ('IVA_EXENTO', 'IVA EXENTO', 'EXENTO') then 'IVA_EXENTO'
  when upper(coalesce(tax_condition, '')) in ('NO_RESPONSABLE', 'NO RESPONSABLE') then 'NO_RESPONSABLE'
  else 'UNKNOWN'
end;

update public.customer_fiscal_profiles
set validation_source = null
where validation_source is not null
  and validation_source <> 'AFIPSDK_WS_SR_CONSTANCIA_INSCRIPCION';

update public.customer_fiscal_profiles
set
  tax_condition = coalesce(tax_condition, 'UNKNOWN'),
  tax_condition_source = case
    when validation_status = 'VALIDATED_AUTO' and tax_condition is not null then coalesce(tax_condition_source, 'OFFICIAL_DERIVED')
    else coalesce(tax_condition_source, 'UNKNOWN')
  end,
  legal_name_source = case
    when validation_status = 'VALIDATED_AUTO' and legal_name is not null and btrim(legal_name) <> '' then coalesce(legal_name_source, 'OFFICIAL')
    else coalesce(legal_name_source, 'UNKNOWN')
  end
where tax_condition_source is null
   or legal_name_source is null
   or tax_condition is null;

alter table public.customer_fiscal_profiles
  alter column tax_condition set default 'UNKNOWN',
  alter column tax_condition set not null;

alter table public.customer_fiscal_profiles
  drop constraint if exists customer_fiscal_profiles_validation_status_check,
  add constraint customer_fiscal_profiles_validation_status_check check (
    validation_status in ('PENDING', 'VALIDATED_AUTO', 'ERROR')
  ),
  drop constraint if exists customer_fiscal_profiles_tax_condition_check,
  add constraint customer_fiscal_profiles_tax_condition_check check (
    tax_condition in ('RESPONSABLE_INSCRIPTO', 'MONOTRIBUTO', 'IVA_EXENTO', 'NO_RESPONSABLE', 'UNKNOWN')
  ),
  drop constraint if exists customer_fiscal_profiles_validation_source_check,
  add constraint customer_fiscal_profiles_validation_source_check check (
    validation_source is null or validation_source in ('AFIPSDK_WS_SR_CONSTANCIA_INSCRIPCION')
  ),
  drop constraint if exists customer_fiscal_profiles_tax_condition_source_check,
  add constraint customer_fiscal_profiles_tax_condition_source_check check (
    tax_condition_source is null or tax_condition_source in ('OFFICIAL_DERIVED', 'UNKNOWN')
  ),
  drop constraint if exists customer_fiscal_profiles_legal_name_source_check,
  add constraint customer_fiscal_profiles_legal_name_source_check check (
    legal_name_source is null or legal_name_source in ('OFFICIAL', 'UNKNOWN')
  );
