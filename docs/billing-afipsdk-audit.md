# Stock Sur - Billing Afip SDK audit

Fecha: 2026-06-02
Branch: `chore/billing-afipsdk-audit`
Base auditada: `origin/staging`

Alcance: diagnostico y diseno inicial del modulo Facturacion con Afip SDK. No se implementa logica, no se crean migraciones, no se toca produccion, no se guardan secretos y no se hardcodean CUIT, tokens, certificados ni credenciales.

Fuentes externas consultadas:

- ARCA publica los Web Services SOAP de factura electronica y lista `wsfev1` para comprobantes A, B, C y M sin detalle de item, y `wsmtxca` para A/B con detalle de items: https://www.afip.gob.ar/ws/documentacion/ws-factura-electronica.asp
- Afip SDK documenta integracion API REST con `Authorization: Bearer`, endpoint base `https://app.afipsdk.com/api/`, TA cacheado y ambiente `dev`/`prod`: https://docs.afipsdk.com/integracion/api
- Afip SDK referencia `FECAESolicitar` como solicitud de CAE para WSFE y enumera Factura A/B/C, notas de credito/debito y metodos como ultimo comprobante y tablas de referencia: https://afipsdk.com/docs/api-reference/web-services/wsfe/FECAESolicitar/dev/api/
- Afip SDK documenta QR fiscal como generacion local siguiendo especificacion oficial ARCA: https://docs.afipsdk.com/siguientes-pasos/web-services/factura-electronica/codigo-qr
- Afip SDK movio la documentacion de PDFs a un modulo separado y su pricing muestra costos por CUIT, requests y PDFs: https://docs.afipsdk.com/siguientes-pasos/web-services/factura-electronica/crear-pdf y https://afipsdk.com/pricing/

## 1. Diagnostico modelo actual

El sistema actual no tiene una entidad fiscal propia. `documents` modela documentos comerciales (`PRESUPUESTO`, `REMITO`, `REMITO_DEVOLUCION`) y `cash_sales` modela caja/cobros. La palabra "factura" aparece hoy como referencia externa: `documents.external_invoice_number`, `documents.external_invoice_date`, `documents.external_invoice_status` y `cash_sales.receipt_kind = FACTURA` con `receipt_reference`.

La emision comercial ocurre por RPC `issue_document`. Para `REMITO`, la RPC asigna numero interno con `document_sequences`, valida stock, genera `stock_movements` `OUT` y, si corresponde, debita cuenta corriente. Para `REMITO_DEVOLUCION`, valida el remito origen, revierte stock con `IN`, acredita cuenta corriente y registra eventos. Este flujo no debe mezclarse con autorizacion fiscal.

El modelo multitenant esta basado en `company_id`, RLS y permisos con `has_company_permission(auth.uid(), company_id, '<permission>')`. Facturacion debe seguir ese patron y no reutilizar permisos de documentos/caja para autorizaciones fiscales.

## 2. Remitos and cash sales today

Los remitos emitidos son la pieza que hoy mueve stock y puede disparar cuenta corriente. `cash_sales` permite registrar el cobro de una venta, asociando un remito cuando `receipt_kind = REMITO`. Para `receipt_kind = FACTURA`, el flujo actual asocia la caja por `receipt_reference`, normalmente contra `documents.external_invoice_number`; no hay una factura fiscal persistida ni CAE.

`useCashData` arma remitos disponibles para caja y remitos "facturables" con `external_invoice_number`. `useCashMutations` toma el total desde el remito seleccionado y crea la venta de caja; para factura legacy, deja `document_id = null` y guarda la referencia externa. Eso evita duplicar cobros, pero no alcanza para facturacion electronica porque no existe trazabilidad fiscal, request/response AFIP, CAE, punto de venta fiscal ni estado fiscal.

El cierre de caja (`cash_closures`) bloquea cambios posteriores mediante triggers. Cualquier facturacion futura debe tratar la factura como salida fiscal posterior o paralela, no como mutacion de caja cerrada.

## 3. Exact recommended factura source entity

La fuente recomendada para el MVP es `cash_sales.id` cuando la venta fue creada desde un remito emitido:

- `cash_sales.status <> ANULADA`.
- `cash_sales.receipt_kind = REMITO` o un nuevo estado futuro equivalente que represente venta cobrada/registrada desde remito.
- `cash_sales.document_id` apunta a `documents.id` de un `REMITO` en `status = EMITIDO`.
- `cash_sales.company_id = documents.company_id`.

La factura fiscal debe nacer desde la venta de caja porque esa entidad representa el evento economico de cobro/venta en caja. El remito sigue siendo la fuente de lineas, stock y total comercial. En la tabla fiscal conviene guardar ambos punteros: `source_type = CASH_SALE_FROM_REMITO`, `source_id = cash_sales.id` y `source_remito_id = documents.id`.

No conviene emitir facturas directamente desde `documents` para el MVP, porque se perderia la relacion con caja y aumentaria el riesgo de facturar remitos que nunca fueron cobrados o registrados como venta.

## 4. Factura relationship with remito/caja

La factura debe ser un ledger fiscal independiente:

- `billing_documents.source_id` referencia la `cash_sales` fuente.
- `billing_documents.source_remito_id` referencia el `REMITO` comercial.
- `billing_document_lines.source_document_line_id` referencia las lineas del remito cuando existan.
- `billing_documents.cash_sale_id` puede existir como alias explicito si se prefiere claridad operativa, pero debe ser consistente con `source_id`.

Relacion esperada:

`REMITO EMITIDO` -> mueve stock y opcionalmente cuenta corriente.
`cash_sales` -> registra la venta/cobro y queda en caja.
`billing_documents` -> autoriza fiscalmente Factura A/B o Nota de Credito y guarda CAE/AFIP.

La factura no debe cambiar el numero interno del remito, no debe reabrir caja y no debe modificar `external_invoice_number` como mecanismo principal. Ese campo puede quedar como compatibilidad legacy hasta migrar reportes.

## 5. Avoid stock/caja/account duplication

Regla central: facturar no mueve stock, no crea cobro y no crea asiento de cuenta corriente.

Stock:

- Stock ya fue afectado por `issue_document` del remito.
- Nota de credito fiscal tampoco debe hacer `stock_movements`; una devolucion fisica sigue usando `REMITO_DEVOLUCION`.

Caja:

- Caja ya fue afectada por `cash_sales`.
- Autorizar una factura solo cambia tablas `billing_*`.
- Si caja esta cerrada, la factura puede autorizarse si la venta fuente existe y no esta anulada, pero debe quedar auditado que la autorizacion fiscal fue posterior al cierre. Esta politica debe confirmarse antes de implementar.

Cuenta corriente:

- Cuenta corriente ya se registra desde remitos con `payment_terms = CUENTA_CORRIENTE` o desde caja segun el flujo actual.
- Nota de credito fiscal no debe acreditar cuenta corriente. Si hay devolucion comercial, se usa `REMITO_DEVOLUCION` y el flujo existente acredita.

## 6. Customer fiscal data state

`customers` tiene `name`, `cuit`, `email`, `phone` e `is_occasional`. No tiene razon social fiscal separada, condicion IVA, domicilio fiscal, estado de validacion, fecha de validacion ni respuesta cruda del padron.

`documents` guarda snapshots parciales (`customer_tax_id`, `customer_tax_condition`, `customer_kind`), pero esos campos no reemplazan un perfil fiscal validado. Para emitir Factura A/B con trazabilidad, el sistema necesita snapshot fiscal en el momento de autorizar el comprobante, no solo datos editables del cliente.

Recomendacion: agregar en fase futura una tabla `customer_fiscal_profiles` o columnas fiscales dedicadas en `customers`, mas snapshots en `billing_documents`. Para auditoria y defensibilidad, prefiero `customer_fiscal_profiles` porque separa identidad comercial de validacion fiscal.

## 7. Missing for Factura A

Para Factura A falta:

- CUIT validado del receptor.
- Razon social fiscal.
- Condicion frente al IVA.
- Domicilio fiscal o direccion fiscal declarada.
- Snapshot de datos fiscales al momento de emitir.
- Validacion de que el receptor permite Factura A segun condicion fiscal.
- Configuracion fiscal de la empresa emisora: CUIT, condicion IVA, punto de venta fiscal habilitado, ambiente, proveedor y estado de credenciales.
- Permisos especificos para autorizar comprobantes.
- Calculo fiscal consistente de neto/IVA/total. Hoy muchos totales comerciales usan `tax_total`, pero debe validarse si las lineas guardan suficiente granularidad de IVA para WSFE.

Sin esos datos, Factura A no deberia entrar al MVP productivo. Puede entrar en homologacion con datos controlados.

## 8. Factura B Consumidor Final

Factura B a Consumidor Final es el mejor candidato para MVP, porque puede emitirse sin cliente identificado cuando el flujo sea venta mostrador. La fuente sigue siendo `cash_sales` con remito emitido.

Reglas recomendadas:

- Si no hay cliente o el cliente es ocasional, snapshot de receptor: nombre visible `Consumidor Final`, tipo documento fiscal de consumidor final y numero fiscal segun reglas ARCA/Afip SDK vigentes.
- No crear cliente artificial.
- No exigir CUIT.
- Mostrar siempre el receptor fiscal final en la vista/print de factura.
- Validar montos/limites y datos requeridos por normativa vigente durante la implementacion, no en este audit.

Afip SDK expone ejemplos de WSFE donde Factura B usa `CbteTipo = 6` y consumidor final usa tipo de documento de consumidor final en sus tablas de referencia; la implementacion debe confirmar los codigos contra la tabla vigente antes de produccion.

## 9. Recommended tables

Tablas recomendadas para una fase de migracion futura:

`billing_settings`

- `id`
- `company_id`
- `provider` (`AFIPSDK`)
- `environment` (`dev`, `prod`)
- `issuer_tax_id`
- `issuer_legal_name`
- `issuer_tax_condition`
- `default_currency`
- `default_concept`
- `credentials_status`
- `provider_account_ref`
- `created_at`, `updated_at`

No guardar certificados, keys, access tokens ni secretos en esta tabla. Usar Supabase Edge secrets o vault externo. Para multi-CUIT, evolucionar a `billing_accounts` por `company_id + issuer_tax_id + environment`.

`billing_points_of_sale`

- `id`
- `company_id`
- `billing_settings_id`
- `point_of_sale`
- `afip_ws`
- `enabled`
- `last_known_voucher_number`
- `created_at`, `updated_at`

El numero fiscal no debe salir de `document_sequences`; debe consultarse/confirmarse con AFIP/Afip SDK y persistirse solo como resultado fiscal.

`billing_documents`

- `id`
- `company_id`
- `source_type`
- `source_id`
- `source_remito_id`
- `related_billing_document_id` para notas de credito/debito
- `document_kind` (`INVOICE`, `CREDIT_NOTE`, `DEBIT_NOTE`)
- `invoice_type` (`A`, `B`, futuro `C`, `M`)
- `fiscal_status` (`DRAFT`, `AUTHORIZING`, `AUTHORIZED`, `REJECTED`, `VOIDED`)
- `environment`
- `issuer_tax_id`, `issuer_legal_name`, `issuer_tax_condition`
- `receiver_name`, `receiver_tax_id`, `receiver_doc_type`, `receiver_tax_condition`, `receiver_fiscal_address`
- `point_of_sale`
- `voucher_number`
- `voucher_date`
- `currency`, `currency_rate`
- `subtotal`, `tax_total`, `non_taxed_total`, `exempt_total`, `tributes_total`, `total`
- `cae`, `cae_expires_at`
- `provider`, `provider_request`, `provider_response`, `provider_errors`, `provider_observations`
- `authorized_at`, `authorized_by`
- `created_at`, `updated_at`

`billing_document_lines`

- `id`
- `company_id`
- `billing_document_id`
- `source_document_line_id`
- `description`
- `quantity`
- `unit_price`
- `discount_total`
- `net_amount`
- `vat_rate`
- `vat_amount`
- `total`

`billing_events`

- `id`
- `company_id`
- `billing_document_id`
- `event_type`
- `actor_user_id`
- `metadata`
- `created_at`

Permisos nuevos:

- `billing.view`
- `billing.create`
- `billing.authorize`
- `billing.credit_note`
- `billing.print`
- `billing.settings`

Indices/constraints futuros:

- Unicidad de comprobante fiscal autorizado por `company_id`, `environment`, `issuer_tax_id`, `point_of_sale`, `invoice_type`, `voucher_number`.
- Unicidad de factura autorizada por fuente: no mas de una factura activa/autorizada para el mismo `source_type + source_id`.
- RLS por `company_id` y permisos `billing.*`.

## 10. Recommended Edge Function/provider

Recomendacion: Supabase Edge Functions con llamadas REST a Afip SDK por `fetch`, no paquete Node dentro del cliente ni SDK embebido en frontend.

Funciones sugeridas:

- `billing-validate-cuit`: valida datos fiscales y actualiza `customer_fiscal_profiles` o devuelve snapshot. Requiere `billing.create` o permiso de clientes.
- `billing-authorize-document`: toma `source_type/source_id`, valida permisos `billing.authorize`, bloquea/idempotentiza, arma payload WSFE, llama Afip SDK, persiste `billing_documents`, `billing_events` y respuesta.
- `billing-render-pdf`: opcional. Para MVP puede no existir si se usa HTML print propio; si se usa PDF de Afip SDK, debe consumir el modulo de PDFs como costo/servicio separado.
- `billing-sync-voucher`: consulta comprobante/ultimo numero ante reintentos o soporte.

Patron tecnico:

- JWT verificado.
- Actor client con Authorization header para respetar RLS donde aplique.
- Service role solo para operaciones internas estrictamente necesarias.
- Secretos con `Deno.env.get`, nunca en DB ni repo.
- Idempotency key basada en `company_id + source_type + source_id + invoice_type`.
- Estado `AUTHORIZING` antes de llamar al proveedor para reducir doble emision.

## 11. Afip SDK evaluation

Afip SDK es viable como proveedor inicial si se integra por API REST desde Edge Functions. La documentacion API indica uso de `Authorization: Bearer`, JSON y endpoint base; tambien indica que el TA de ARCA expira y Afip SDK lo cachea/renueva. Esto reduce complejidad frente a SOAP/WSAA directo.

Ventajas:

- Evita implementar SOAP/WSAA directamente en la primera fase.
- Soporta ambiente `dev` y `prod`.
- Expone WSFE/FECAESolicitar, ultimo comprobante, consulta de comprobante y tablas de referencia.
- Pricing claro por CUIT/request y modulo PDF separado.

Limitaciones/riesgos:

- Es un intermediario comercial, no organismo oficial.
- Costos cambian y deben revisarse al contratar.
- PDF no debe asumirse incluido: el pricing lo separa por volumen.
- Si se necesita detalle de items exigido por regimen especifico, ARCA diferencia `wsfev1` sin detalle de item de `wsmtxca` con detalle. MVP debe confirmar si Stock Sur puede operar con `wsfev1` o si necesita `wsmtxca`.
- La libreria Node no es necesaria para Supabase Edge; la API REST reduce riesgo de compatibilidad Deno.

Dictamen tecnico: usar Afip SDK API REST para homologacion/MVP, con abstraccion `billing_provider = AFIPSDK` para permitir reemplazo por ARCA directo u otro proveedor.

## 12. Risks

- Doble emision por retry concurrente si no hay lock/idempotencia.
- Numeracion fiscal incorrecta si se usa secuencia local en vez de consultar/procesar AFIP.
- Factura A con datos fiscales incompletos o no validados.
- Incompatibilidad entre totales comerciales actuales y payload fiscal neto/IVA.
- Confusion entre `external_invoice_number` legacy y nuevo `billing_documents`.
- Facturar ventas con caja cerrada sin politica explicita.
- Notas de credito confundidas con devoluciones fisicas.
- Secretos cargados accidentalmente en DB, frontend o migraciones.
- Costos del proveedor por CUIT, requests y PDFs.
- Requisitos regulatorios especificos por actividad/regimen que obliguen a itemizar o usar otro web service.
- Impresion/PDF sin QR o datos fiscales obligatorios.

## 13. Implementation phases

Fase 0 - Audit actual:

- Este documento.
- Sin codigo, sin migraciones, sin produccion.

Fase 1 - Modelo fiscal y permisos:

- Crear tablas `billing_*`, permisos `billing.*`, RLS y seeds de roles.
- Agregar settings fiscales sin secretos.
- Agregar feature flag por empresa.

Fase 2 - Datos fiscales de cliente:

- Agregar perfil fiscal.
- Validacion CUIT en homologacion.
- UI para completar/validar receptor.

Fase 3 - Draft fiscal:

- Crear borrador desde `cash_sales` con remito.
- Congelar snapshot de emisor/receptor/lineas/totales.
- Validar Factura B consumidor final.

Fase 4 - Autorizacion homologacion:

- Edge Function `billing-authorize-document`.
- Afip SDK REST en `dev`.
- Guardar request/response, CAE, observaciones y errores.

Fase 5 - Print/PDF:

- HTML print fiscal con QR y datos obligatorios.
- Evaluar PDF Afip SDK solo si el costo/operacion lo justifica.

Fase 6 - Notas de credito:

- Solo nota de credito total contra factura autorizada.
- Sin mutar stock, caja ni cuenta corriente.

Fase 7 - Hardening y produccion:

- Monitoreo, retries, soporte, logs.
- Checklist de punto de venta, certificado/delegacion, secretos y pruebas.
- Corte controlado a `prod`.

Fase 8 - Expansiones:

- Notas parciales.
- Factura A productiva.
- Factura C/M si aplica.
- Libro IVA/reportes fiscales.
- Multi-CUIT avanzado.

## 14. Open questions

- Stock Sur emitira solo Factura B al inicio o tambien Factura A desde el MVP?
- La empresa emisora es Responsable Inscripto, Monotributista u otra condicion?
- Hay obligacion por actividad/regimen de usar `wsmtxca` con detalle de items?
- Se permite facturar una venta cuya caja ya esta cerrada?
- Que ocurre con ventas ya registradas como `receipt_kind = FACTURA` legacy?
- Se migraran `external_invoice_number` existentes a `billing_documents` como historico no autorizado por sistema?
- El comprobante fiscal debe salir inmediatamente al cobrar o puede emitirse posteriormente desde una bandeja?
- Se necesita PDF server-side o alcanza HTML print fiscal en MVP?
- Se requiere factura por pago parcial o solo por total de remito?
- Como se resolveran redondeos de IVA frente a listas de precio y descuentos actuales?
- Cual sera el CUIT/punto de venta de homologacion y quien administra los secretos en Supabase?

## 15. Final recommendation for MVP

El MVP debe emitir Factura B a Consumidor Final o cliente simple desde `cash_sales` asociada a un `REMITO EMITIDO`, usando el remito como fuente de lineas y la caja como fuente economica. La factura debe persistirse en `billing_documents`, separada de `documents`, `cash_sales`, stock y cuenta corriente.

Usar Supabase Edge Function + Afip SDK API REST en ambiente `dev` para autorizar. Guardar request/response, CAE, vencimiento, punto de venta, numero fiscal, QR data y eventos. No usar `document_sequences` para numeros fiscales. No guardar secretos en DB ni frontend.

No incluir Factura A productiva hasta incorporar perfil fiscal validado de clientes y configuracion fiscal completa de la empresa. No incluir notas parciales al inicio; implementar solo nota de credito total contra factura autorizada cuando el flujo de factura base este estable.

Dictamen de siguiente fase: avanzar con una migracion de modelo fiscal y permisos en una rama separada, detras de feature flag y solo en homologacion. El primer hito tecnico debe ser autorizar una Factura B desde una venta de caja con remito, sin modificar stock, caja ni cuenta corriente.
