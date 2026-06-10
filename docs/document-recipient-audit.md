# Auditoria: destinatario de documentos

Fecha: 2026-06-08
Rama: `audit/document-recipient-flow`
Base: `origin/staging`

## Alcance

Auditoria de creacion y edicion de `PRESUPUESTO`, `REMITO` y `REMITO_DEVOLUCION`, con foco en:

- Cliente registrado.
- Cliente ocasional / consumidor final.
- Empresa como tipo de destinatario.
- Personal / tecnico interno.
- Campo manual `Nombre cliente`.
- Impactos en impresion, caja, cuenta corriente, stock, servicios y facturacion fiscal.

No se implementaron cambios funcionales. No se agregaron migraciones. No se toco produccion. No se ejecuto `db:push:prod`.

## Resumen ejecutivo

El flujo actual mezcla dos conceptos distintos en el mismo campo `documents.customer_name`:

1. Snapshot del cliente registrado al momento de guardar.
2. Texto manual para operaciones ocasionales.

La regla de display actual considera que `customer_id = null` siempre debe verse como `Cliente ocasional / Consumidor Final`, aunque `customer_name` tenga un texto manual. Esto hace que el nombre manual se guarde, pero quede oculto en Documentos, detalle e impresion A4. Caja, en cambio, usa `customer_name` directo y puede mostrar un snapshot distinto. Esa divergencia puede romper trazabilidad operacional.

Tambien hay una zona de riesgo con remitos internos: al cambiar `Tipo de cliente` a `INTERNO`, la UI no limpia `customer_id`, `payment_terms`, `service_id` ni datos fiscales. El RPC de emision genera debito de cuenta corriente para remitos con `customer_id` registrado no ocasional y `payment_terms = CUENTA_CORRIENTE`, sin excluir `customer_kind = INTERNO`. Eso puede impactar cuenta corriente si el borrador queda contaminado con datos previos.

Dictamen: LISTO PARA DISENAR FIX, pero NO APTO PARA IMPLEMENTAR DIRECTO sin decidir reglas finales de modelo/display.

## Archivos principales revisados

- `src/features/documents/types.ts`
- `src/features/documents/utils.ts`
- `src/features/documents/hooks/useDocumentsData.ts`
- `src/features/documents/hooks/useDocumentsMutations.ts`
- `src/features/documents/hooks/useDocumentDraftLoader.ts`
- `src/features/documents/components/DocumentsEditorDialog.tsx`
- `src/features/documents/components/DocumentsDataTable.tsx`
- `src/features/documents/components/DocumentsPreviewDialog.tsx`
- `src/features/documents/print.ts`
- `src/features/documents/lib/duplicate.ts`
- `src/features/documents/lib/returns.ts`
- `src/pages/Documents.tsx`
- `src/pages/Cash.tsx`
- `src/features/cash/hooks/useCashData.ts`
- `src/features/cash/hooks/useCashMutations.ts`
- `src/features/billing/hooks/useBillingActions.ts`
- `src/features/billing/hooks/useBillingData.ts`
- `src/features/billing/lib/authorization.ts`
- `src/features/billing/print.ts`
- `src/pages/Billing.tsx`
- `src/pages/PrintBilling.tsx`
- `src/features/service-jobs/hooks/useServiceJobs.ts`
- `src/features/service-jobs/lib/serviceRemitos.ts`
- `src/features/technicians/types.ts`
- `supabase/migrations/20260305140000_documents_phase1.sql`
- `supabase/migrations/20260306153000_documents_phase3_workflow_es.sql`
- `supabase/migrations/20260430120000_tecnicos_remitos_devoluciones.sql`
- `supabase/migrations/20260511160000_service_remito_links.sql`
- `supabase/migrations/20260528120000_remito_devolucion_cash_adjustments.sql`
- `supabase/migrations/20260605120000_billing_invoice_a_draft_gated.sql`
- `supabase/migrations/20260603170000_billing_credit_note_b_dev.sql`

## Tablas y campos relevantes

### `documents`

Campos de destinatario y trazabilidad:

- `customer_id uuid null references customers(id)`
- `customer_name text null`
- `customer_tax_id text null`
- `customer_tax_condition text null`
- `customer_kind document_customer_kind not null default 'GENERAL'`
- `internal_remito_type internal_remito_type null`
- `technician_id uuid null references technicians(id)`
- `service_id uuid null references service_job_services(id)`
- `payment_terms text null`
- `delivery_address text null`
- `salesperson text null`
- `source_document_id uuid null`
- `origin_document_id uuid null`

`document_customer_kind` hoy contiene `GENERAL`, `INTERNO`, `EMPRESA`. No existe un enum explicito `OCCASIONAL`; el cliente ocasional se modela por `customer_id = null`.

### `customers`

Campos relevantes:

- `id`
- `company_id`
- `name`
- `cuit`
- `is_occasional`

Factura A y servicios distinguen clientes ocasionales con `customers.is_occasional`, pero Documentos tambien permite operaciones sin `customer_id`.

### `customer_fiscal_profiles`

Campos relevantes para Factura A:

- `customer_id`
- `tax_id`
- `legal_name`
- `tax_condition`
- `validation_status`
- `validation_source`
- `tax_condition_source`
- `legal_name_source`
- `taxpayer_status`

Factura A solo queda habilitable para perfil real `VALIDATED_AUTO`, razon social oficial, condicion oficial derivada, CUIT activo y RI.

### `technicians`

Campos relevantes:

- `id`
- `company_id`
- `name`
- `phone`
- `notes`
- `is_active`

Tecnico es entidad operativa interna. No es cliente y no deberia competir con `customer_id` como destinatario comercial.

### `service_jobs` y `service_job_services`

Los trabajos de servicio seleccionan clientes registrados no ocasionales. `service_id` en `documents` vincula un REMITO a un servicio, pero el trigger solo valida empresa y tipo de documento. No valida que el cliente del remito coincida con el cliente del servicio.

### `cash_sales` y `cash_adjustments`

Campos relevantes:

- `customer_id`
- `customer_name_snapshot`
- `document_id`
- `receipt_kind`
- `payment_method`

Caja usa snapshots propios y puede recibir `customer_name` directo desde remitos.

### `billing_documents`

Campos relevantes:

- `receiver_name`
- `receiver_doc_type`
- `receiver_doc_number`
- `receiver_tax_condition`
- `receiver_fiscal_snapshot`
- `invoice_type`
- `fiscal_status`
- `environment`

Factura B toma consumidor final por defecto. Factura A usa perfil fiscal oficial del cliente registrado. Nota Credito B copia receptor desde Factura B autorizada.

## Modelo actual de cliente, empresa y tecnico

### Cliente registrado

En la UI se selecciona en `Cliente registrado`. Al guardar:

- `documents.customer_id` queda con el id del cliente.
- `documents.customer_name` queda como snapshot de `customers.name`.
- `documents.customer_tax_id` queda con `customers.cuit`.
- `documents.customer_tax_condition` queda `null`.

El campo manual `Nombre cliente` se vuelve read-only, pero sigue siendo el mismo estado `customer_name`.

### Cliente ocasional

Se representa por ausencia de `customer_id`. Al guardar:

- `documents.customer_id = null`.
- `documents.customer_name = manualCustomerName || "Cliente ocasional / Consumidor Final"`.
- CUIT y condicion fiscal manuales se guardan si se completan.

Problema: `getCustomerDisplayName` ignora `customer_name` cuando `customer_id` es null, por lo que lista, detalle e impresion muestran siempre `Cliente ocasional / Consumidor Final`.

### Empresa

`customer_kind = EMPRESA` es solo una etiqueta semantica dentro del documento. No hay tabla separada de empresas destinatarias ni seleccion propia. Puede combinarse con `customer_id` registrado o con `customer_id = null`, porque la validacion no exige cliente registrado para `EMPRESA`.

Tambien existe `company_id`, que es la empresa operadora del sistema. No debe confundirse con `customer_kind = EMPRESA`.

### Tecnico interno

`customer_kind = INTERNO` se permite solo para REMITO. Requiere `internal_remito_type` al guardar y al emitir. La UI permite seleccionar tecnico para cualquier tipo de documento, pero la emision solo exige tecnico en `REMITO_DEVOLUCION`; no lo exige para REMITO interno.

`INTERNO` no limpia ni bloquea `customer_id`, `payment_terms`, `service_id`, CUIT o condicion fiscal.

## Campo manual `Nombre cliente`

### Donde aparece

En `DocumentsEditorDialog`, dentro de opciones avanzadas:

- Label: `Nombre cliente`.
- Placeholder: `Cliente ocasional / Consumidor Final`.
- Estado: read-only si hay `customer_id`.

### Campo de base de datos

Se guarda en `documents.customer_name`.

### Con cliente registrado

No se guarda el texto manual libre. Si hay `customer_id`, `buildDocumentCustomerSnapshot` reemplaza `customer_name` por `pickedCustomer.name`.

### Sin cliente registrado

Se guarda el texto manual en `documents.customer_name`, pero el helper de display lo oculta para `customer_id = null`.

### Sobrescritura

No sobrescribe un cliente registrado si el flujo normal llega a `buildDocumentCustomerSnapshot` con `pickedCustomer`. Pero como el mismo estado `customer_name` cumple doble funcion, la UI queda confusa: el usuario ve un campo que parece nombre del cliente y no una referencia ocasional.

### Impactos

- Impresion de documentos: oculta nombre manual ocasional.
- Lista/detalle de documentos: oculta nombre manual ocasional.
- Caja: puede usar nombre manual por snapshot, generando diferencia contra Documentos/impresion.
- Facturacion B: no usa nombre manual; usa Consumidor Final.
- Factura A: no se habilita por nombre manual porque exige `customer_id` registrado y perfil fiscal valido.
- Cuenta corriente: no usa nombre manual; depende de `customer_id` real y forma de pago.

## Duplicidades

- `customer_id` y `customer_name` conviven como identidad y snapshot, pero `customer_name` tambien funciona como texto manual.
- `customer_kind = EMPRESA` se superpone con clientes registrados que pueden ser empresas.
- `customer_kind = INTERNO`, `technician_id` e `internal_remito_type` se superponen para describir una salida interna.
- `payment_terms = CUENTA_CORRIENTE` e `internal_remito_type = CUENTA_CORRIENTE` comparten literal semantico, pero impactan cosas distintas.
- Servicios guardan cliente en `service_jobs.customer_id`, mientras remitos guardan `documents.customer_id`; la relacion no se valida en DB.
- Caja vuelve a guardar `customer_name_snapshot`, que puede no coincidir con el display de Documentos.

## Bugs y riesgos detectados

1. Nombre manual ocasional guardado pero oculto.
   - Causa: `getCustomerDisplayName` devuelve siempre `OCCASIONAL_CUSTOMER_DISPLAY_NAME` cuando `customer_id` es null.
   - Impacto: lista, detalle e impresion pierden la referencia operativa.

2. Inconsistencia entre Documentos e Caja.
   - Documentos/impresion muestran consumidor final.
   - Caja usa `selectedRemito?.customer_name` o `v_doc.customer_name`.
   - Impacto: la misma operacion puede verse con distinto receptor interno.

3. Auto-seleccion de un cliente llamado `cliente ocasional`.
   - `DocumentsPage` busca un cliente cuyo nombre sea `cliente ocasional` y lo asigna como default.
   - Esto contradice la regla nueva de cliente ocasional como `customer_id = null`.

4. `INTERNO` puede conservar `customer_id`.
   - Cambiar el tipo de cliente no limpia cliente registrado.
   - Impacto: el remito interno puede quedar asociado a cliente externo.

5. Riesgo de debito indebido en cuenta corriente.
   - `issue_document` registra debito si REMITO + cliente real no ocasional + `payment_terms = CUENTA_CORRIENTE`.
   - No excluye `customer_kind = INTERNO`.
   - Si un remito interno conserva `customer_id` y `payment_terms`, puede afectar cuenta corriente.

6. Remito interno no exige tecnico.
   - La UI permite tecnico, pero guardar/emision no lo exigen para REMITO interno.
   - Impacto: salida interna sin responsable operativo.

7. Servicio asociado no valida cliente.
   - UI advierte si el servicio pertenece a otro cliente, pero permite guardar.
   - Trigger solo valida empresa y doc_type REMITO.

8. `EMPRESA` no tiene regla fuerte.
   - Puede existir con o sin `customer_id`.
   - No queda claro si debe representar cliente empresa registrado, receptor manual o tipo comercial.

9. CUIT/condicion fiscal manual visibles aunque hay cliente registrado.
   - Se limpian al elegir cliente, pero siguen editables en pantalla.
   - Al guardar con cliente registrado, `customer_tax_condition` se descarta y `customer_tax_id` sale del cliente.

10. Duplicar, convertir y devolver copian snapshots.
    - Es correcto como snapshot, pero si el origen esta contaminado, la contaminacion se propaga.

## Casos que rompen o quedan ambiguos

- Usuario crea remito sin cliente, escribe `Juan Perez obra X`: se guarda, pero el remito impreso dice `Cliente ocasional / Consumidor Final`.
- Usuario registra caja desde ese remito: caja puede mostrar `Juan Perez obra X`, distinto del remito impreso.
- Usuario selecciona cliente registrado, cambia a `INTERNO`, pone imputacion y emite: puede quedar asociado al cliente.
- Usuario deja `payment_terms = CUENTA_CORRIENTE` en un remito interno contaminado con cliente registrado: puede generar debito.
- Usuario asocia remito a servicio de otro cliente: queda permitido y solo avisado.
- Usuario marca `EMPRESA` sin seleccionar cliente: no hay identidad fiscal/registrada garantizada.
- Presupuesto con tecnico seleccionado: se guarda aunque tecnico no es requerido ni claro para presupuesto.
- Conversion de presupuesto a remito copia tecnico y cliente sin reevaluar reglas del nuevo tipo documental.

## Matriz documento vs campos requeridos

| Documento | Cliente registrado | Referencia ocasional | Tipo cliente | Tecnico | Servicio | Emision/estado | Impactos |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PRESUPUESTO | Opcional hoy | Opcional hoy | GENERAL/EMPRESA; INTERNO bloqueado | Opcional hoy | No aplica | No se emite fiscal/stock | No stock, no caja, no cuenta corriente |
| REMITO general | Opcional hoy | Opcional si no hay cliente | GENERAL/EMPRESA/INTERNO | Opcional hoy | Opcional | Se emite, descuenta stock | Puede ir a caja, facturacion B, cuenta corriente |
| REMITO interno | No deberia tener `customer_id` | No deberia ser "cliente" | INTERNO | Deberia ser requerido | Normalmente no deberia usar servicio externo | Se emite, descuenta stock | Riesgo cuenta corriente si conserva cliente + payment_terms |
| REMITO de servicio | Deberia coincidir con job | No deberia si servicio exige cliente registrado | GENERAL | Segun servicio; si un tecnico unico se precarga | Requerido desde servicio | Se emite, descuenta stock | Trazabilidad servicio/materiales |
| REMITO_DEVOLUCION | Copia origen | Copia origen | Copia origen | Requerido | No edicion manual directa | Se emite, ingresa stock | Puede generar ajuste caja y credito cuenta corriente |
| FACTURA_B | Nace de caja/remito | Siempre consumidor final fiscal | No usa `customer_kind` | No aplica | Indirecto por remito | Autorizable dev | No debe depender de manual name |
| FACTURA_A | Requiere cliente registrado + perfil valido | No permitido | No usa manual | No aplica | Indirecto | Solo borrador, autorizacion bloqueada | No debe habilitarse por manual |
| NOTA_CREDITO_B | Copia Factura B | Copia receptor Factura B | No aplica | No aplica | Indirecto | Autorizable dev si FB autorizada | No stock/caja/cuenta corriente |
| NOTA_CREDITO_A | No implementada | No aplica | No aplica | No aplica | No aplica | No implementada | Sin flujo actual |

## Propuesta de redisenio

### Regla de dominio recomendada

Separar identidad de referencia:

- `customer_id`: identidad de cliente registrado. Solo si hay cliente real.
- `customer_name`: snapshot del cliente registrado o display interno primario.
- Campo nuevo o semantica explicita: `recipient_reference` / `occasional_reference` para texto manual no fiscal.
- `customer_kind`: tipo operacional, no identidad.
- `technician_id`: responsable interno, no cliente.

### Opcion recomendada para `Nombre cliente`

Recomiendo Opcion B: mantener un campo contextual, pero cambiar label y reglas.

- Si hay cliente registrado:
  - Mostrar `Cliente registrado` como fuente principal.
  - `Nombre visible` viene de `customers.name` o snapshot controlado.
  - Campo manual, si existe, debe llamarse `Referencia interna` y no cambiar `customer_id`.

- Si no hay cliente registrado:
  - Mostrar `Cliente ocasional / Consumidor Final` como receptor fiscal/contable.
  - Campo manual debe llamarse `Referencia ocasional`.
  - Esa referencia no habilita Factura A, no crea cuenta corriente, no cambia `customer_id`, no altera etiqueta fiscal.

- Si `customer_kind = INTERNO`:
  - Ocultar o limpiar cliente registrado.
  - Requerir tecnico.
  - Usar label `Responsable interno` / `Tecnico`.
  - No permitir `payment_terms = CUENTA_CORRIENTE` como condicion comercial del cliente.

### Helper propuesto

Crear helper unico, por ejemplo:

```ts
type RecipientDisplay = {
  primaryName: string;
  secondaryReference: string | null;
  fiscalLabel: string;
  isRegisteredCustomer: boolean;
  isOccasional: boolean;
  isInternal: boolean;
};

function resolveDocumentRecipient(document, options): RecipientDisplay;
```

Reglas:

- `customer_id` presente: `primaryName = customers.name || customer_name || "Cliente registrado"`.
- `customer_id` null y `customer_kind !== INTERNO`: `primaryName = "Cliente ocasional / Consumidor Final"`, `secondaryReference = customer_name` si difiere del default.
- `customer_kind = INTERNO`: `primaryName = technicianName || "Personal interno"`, `secondaryReference = internal_remito_type`.
- Nunca usar referencia manual para habilitar Factura A.
- Nunca usar referencia manual para cuenta corriente.

### Propuesta UI

- Cambiar `Nombre cliente` por label contextual.
- En `Cliente registrado`, usar selector principal y dejar claro `Sin seleccionar = consumidor final`.
- Si no hay cliente registrado, label: `Referencia ocasional`.
- Si hay cliente registrado, campo opcional: `Referencia interna` o directamente ocultarlo.
- Al cambiar a `INTERNO`:
  - Limpiar `customer_id`, `customer_name`, `customer_tax_id`, `customer_tax_condition`, `service_id`.
  - Requerir `technician_id`.
  - Limpiar `payment_terms`.
- Al cambiar de `INTERNO` a otro tipo:
  - Limpiar `internal_remito_type`.
- Para `EMPRESA`, exigir decision:
  - O es cliente registrado empresa.
  - O se elimina como tipo si no tiene comportamiento distinto.
- Para servicios:
  - Si `service_id` tiene cliente, bloquear remito con `customer_id` distinto.
  - Si el servicio tiene un tecnico unico, mantener auto-seleccion; si tiene varios, exigir eleccion.

## Riesgos por modulo

### Stock

Stock se mueve solo al emitir REMITO o REMITO_DEVOLUCION. Cambios de display no deberian tocar stock. Pero corregir reglas de `INTERNO` puede bloquear emisiones antes permitidas; hay que cubrir con tests.

### Caja

Caja toma remitos emitidos y guarda snapshots. Si se cambia display de ocasionales, caja debe decidir si muestra receptor fiscal o referencia ocasional secundaria. No debe usar referencia manual como cliente contable.

### Cuenta corriente

Alto riesgo actual en remito interno contaminado con `customer_id` + `payment_terms = CUENTA_CORRIENTE`. El fix debe excluir `customer_kind = INTERNO` en `issue_document` y limpiar UI.

### Facturacion

Factura B y Nota Credito B estan aisladas de `documents.customer_name` para receptor fiscal y siguen usando `receiver_name`.

Factura A esta bloqueada:

- UI no muestra accion de autorizar Factura A.
- Edge Function rechaza autorizacion de Factura A.
- Draft Factura A requiere `customer_id` y perfil fiscal valido.

Referencia ocasional no debe modificar esa regla.

### Servicios

Riesgo de trazabilidad si un remito se asocia a un servicio de otro cliente. Debe validarse en UI y, preferentemente, en DB/RPC.

## Tests faltantes

- `getCustomerDisplayName` / nuevo helper con referencia ocasional secundaria.
- Guardado de cliente ocasional: `customer_id = null` y referencia no fiscal preservada.
- Guardado con cliente registrado: manual no sobrescribe identidad.
- Cambio `GENERAL -> INTERNO`: limpia cliente, fiscal, service y payment_terms.
- Remito interno requiere tecnico.
- `issue_document` no registra debito si `customer_kind = INTERNO`.
- `service_id` no permite cliente distinto al del servicio.
- Impresion A4 muestra receptor fiscal y referencia ocasional en lugares separados.
- Caja muestra referencia ocasional sin tratarla como cliente registrado.
- Factura A no se habilita por referencia manual.
- Nota Credito A no aparece ni es generable.
- Duplicar/convertir/devolver no propagan estados invalidos.

## QA manual

No se creo, edito, emitio ni anulo ningun documento durante esta auditoria. La validacion manual fue de inspeccion de codigo y flujo para evitar mutaciones en stock, caja, cuenta corriente y facturacion.

Resultado:

- No se tocaron comprobantes productivos.
- No se emitieron remitos ni comprobantes fiscales.
- No se toco produccion.
- No se ejecuto `db:push:prod`.

## Validaciones tecnicas

Pendiente de ejecutar despues de generar este informe:

- `npm run lint`
- `npm run test`
- `npm run build`

## Dictamen

LISTO PARA DISENAR FIX.

Motivos:

- El problema esta localizado y entendible.
- Hay helper existente que puede reemplazarse por una resolucion centralizada.
- El bloqueo de Factura A no depende del campo manual y sigue protegido.
- Factura B/Nota Credito B usan snapshots fiscales propios.

No es apto para fix directo sin definicion de producto porque falta decidir:

- Si `EMPRESA` debe ser un tipo real con reglas o solo cliente registrado.
- Si el campo manual se preserva en `customer_name` o se migra a un campo nuevo.
- Si remito interno debe requerir tecnico siempre.
- Si la referencia ocasional debe imprimirse o solo quedar interna.
