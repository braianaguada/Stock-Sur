# Billing hardening preproduccion

Alcance actual: Factura B Consumidor Final y Nota de Credito B total en AFIPSDK dev/homologacion. No incluye produccion, Factura A, Nota de Credito A, Nota de Debito, facturacion parcial, PDF de Afip SDK ni libro IVA.

Preparacion Factura A futura: clientes registrados pueden tener perfil fiscal separado en `customer_fiscal_profiles`. La validacion automatica consulta AFIPSDK dev con `ws_sr_constancia_inscripcion/getPersona_v2`; si no hay token, CUIT emisor dev o condicion IVA inferible, el perfil queda no validado (`ERROR`). No hay carga manual habilitante. Este flujo no autoriza Factura A ni modifica caja, stock o cuenta corriente.

La aptitud futura para Factura A exige cliente registrado, CUIT valido, razon social con fuente oficial, condicion IVA `RESPONSABLE_INSCRIPTO` derivada oficialmente y estado `VALIDATED_AUTO`. Cliente ocasional / Consumidor Final se representa con `customer_id = null` y no tiene perfil fiscal.

## UX

La pantalla `/billing` queda como superficie operativa:

- listado, filtros y detalle de comprobantes;
- autorizacion en homologacion;
- impresion HTML interna;
- creacion de Nota de Credito B total desde Factura B autorizada;
- recuperacion controlada de autorizaciones trabadas.

La configuracion fiscal vive en `Configuracion > Facturacion fiscal`:

- facturacion interna activa/inactiva;
- provider AFIPSDK;
- environment dev;
- CUIT emisor, razon social y condicion IVA;
- puntos de venta fiscales;
- diagnostico seguro de configuracion;
- mensaje explicito de que tokens/certificados viven en Supabase Secrets.

## Estados fiscales

| Estado | Acciones permitidas | Acciones bloqueadas | Observaciones |
| --- | --- | --- | --- |
| DRAFT | Autorizar si tiene permisos y configuracion valida | Imprimir, crear NC B | Estado inicial de Factura B y NC B. |
| READY_TO_AUTHORIZE | Autorizar si tiene permisos y configuracion valida | Imprimir, crear NC B | Reservado para flujos que preparen validaciones previas. |
| AUTHORIZING | Ver detalle; si es reciente, esperar; si es viejo sin CAE/voucher, liberar | Autorizar, imprimir, crear NC B | Evita doble emision mientras una Edge Function esta en curso. |
| AUTHORIZED | Imprimir; crear NC B solo si es Factura B autorizada sin NC activa | Autorizar, liberar, duplicar NC B | Tiene CAE, numero fiscal y evento AUTHORIZED. |
| REJECTED | Ver error y reintentar autorizacion si mantiene estado autorizable | Imprimir, crear NC B | Guarda request/response sanitizados y evento REJECTED. |
| CANCELLED_INTERNAL | Ver detalle | Autorizar, imprimir, crear NC B, liberar | Estado interno sin emision fiscal nueva. |

## AUTHORIZING trabado

Se agrega la RPC `reset_stale_billing_authorization(billing_document_id)`:

- requiere `billing.authorize`;
- solo acepta `AUTHORIZING`;
- exige mas de 10 minutos desde `updated_at`;
- bloquea si hay CAE o `voucher_number`;
- vuelve a `DRAFT`;
- registra evento `AUTHORIZATION_RESET`;
- no toca stock, caja ni cuenta corriente.

## Errores controlados

La Edge Function normaliza errores frecuentes:

- POS faltante;
- CUIT faltante o invalido;
- credenciales AFIPSDK faltantes o invalidas;
- rate limit;
- timeout;
- documento no autorizable;
- documento ya autorizado;
- Factura B asociada invalida para NC B;
- duplicados.

Los mensajes no deben exponer stacktraces, `Authorization`, `Bearer`, tokens, certificados, private keys, cookies ni secrets.

## Sanitizacion provider_request/provider_response

`sanitizeProviderPayload` redacta:

- `Authorization`;
- `Bearer`;
- `token`, `access_token`, `apiKey`, `key`;
- `sign`;
- `cert`, `certificate`, `privateKey`;
- `password`, `secret`, `cookie`;
- strings con private keys/certificados;
- strings muy largos.

Conserva datos fiscales utiles como `CbteTipo`, `PtoVta`, `CAE`, `CAEFchVto`, observaciones y errores AFIP.

## Diagnostico fiscal

La Edge Function `billing-diagnostics` requiere `billing.settings` y devuelve solo booleanos/estado operativo:

- facturacion interna activa;
- provider AFIPSDK;
- environment dev;
- CUIT configurado y valido;
- POS dev habilitado;
- secrets presentes/ausentes;
- Edge Function disponible;
- ultima autorizacion dev;
- ultimo error dev.

No devuelve valores de secrets.
