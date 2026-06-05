# Auditoria Afip SDK para validacion fiscal de clientes

Fecha: 2026-06-04

## Dictamen

APTO para reemplazar la inferencia anterior por una validacion automatica basada en el Web Service oficial `ws_sr_constancia_inscripcion`, metodo `getPersona_v2`, via API REST de Afip SDK.

BLOQUEADO para habilitar Factura A productiva: este trabajo solo valida y persiste el perfil fiscal del cliente. No implementa emision, Nota de Credito A, punto de venta, comprobantes productivos ni cambios contables.

## Web Service recomendado

- Endpoint TA: `POST https://app.afipsdk.com/api/v1/afip/auth`
- Endpoint request: `POST https://app.afipsdk.com/api/v1/afip/requests`
- `wsid`: `ws_sr_constancia_inscripcion`
- Metodo: `getPersona_v2`
- Ambiente default de consulta Stock Sur: `dev`
- Variable de ambiente lookup: `CUSTOMER_FISCAL_LOOKUP_ENVIRONMENT`, con fallback a `AFIPSDK_ENVIRONMENT` y luego `dev`
- Ambiente de emision fiscal: separado; se resuelve desde `AFIPSDK_ENVIRONMENT`/`billing_settings.environment` y debe seguir en `dev` para esta fase
- CUIT emisor lookup: `CUSTOMER_FISCAL_LOOKUP_ISSUER_TAX_ID`; si falta, fallback a `billing_settings.issuer_tax_id` de la compania, provider `AFIPSDK`, ambiente de emision activo
- CUIT emisor real staging para prueba controlada: TFD S.R.L. `30711582890`

ARCA publica `ws_sr_constancia_inscripcion` como Consulta a Padron Constancia de Inscripcion y aclara que reemplaza a `ws_sr_padron_a5`. `ws_sr_padron_a4` sirve para datos tributarios, pero no es el WS recomendado para constancia actual. `ws_sr_padron_a5` queda descartado por deprecacion/reemplazo.

La consulta de padron no usa `wsfe`: `wsfe` queda reservado para emision/autorizacion fiscal de comprobantes. Consultar padron en `prod` no implica emitir comprobantes en produccion.

## Request sanitizado

Primero se obtiene token/sign:

```json
{
  "environment": "prod",
  "tax_id": "30711582890",
  "wsid": "ws_sr_constancia_inscripcion"
}
```

Luego se consulta el padron:

```json
{
  "environment": "prod",
  "method": "getPersona_v2",
  "wsid": "ws_sr_constancia_inscripcion",
  "params": {
    "token": "[REDACTED]",
    "sign": "[REDACTED]",
    "cuitRepresentada": 30711582890,
    "idPersona": 30711582890
  }
}
```

## Response sanitizado esperado

```json
{
  "personaReturn": {
    "datosGenerales": {
      "idPersona": 30711582890,
      "tipoPersona": "JURIDICA",
      "razonSocial": "CLIENTE EJEMPLO SA",
      "estadoClave": "ACTIVO",
      "domicilioFiscal": {
        "direccion": "CALLE EJEMPLO 123",
        "localidad": "CIUDAD",
        "descripcionProvincia": "PROVINCIA"
      }
    },
    "datosRegimenGeneral": {
      "impuesto": [
        {
          "idImpuesto": 30,
          "descripcionImpuesto": "IVA",
          "estadoImpuesto": "ACTIVO"
        }
      ]
    }
  }
}
```

Para monotributo, el response trae `datosMonotributo`; para IVA exento, se espera impuesto activo con descripcion compatible con IVA exento. Si `estadoClave` no es `ACTIVO`, el perfil no queda validado para Factura A futura.

El normalizador tolera respuestas envueltas en `response.personaReturn`, `response.result.personaReturn`, `response.data.personaReturn`, `response.result`, `response.data` y variantes con `getPersona_v2Return`. Tambien acepta `impuesto` como objeto unico o array, `impuestos`, `idImpuesto` numerico o string, descripcion que contenga `IVA`, `datosMonotributo` y `estadoClave` en niveles anidados.

## Datos cubiertos

- Razon social / nombre fiscal: si aparece en `datosGenerales.razonSocial`, `nombre`, `apellido` o campos equivalentes.
- Condicion frente al IVA: no llega como enum directo. Se deriva oficialmente desde `datosMonotributo` y `datosRegimenGeneral.impuesto`.
- Domicilio fiscal: si aparece en `datosGenerales.domicilioFiscal`.
- Estado activo: `datosGenerales.estadoClave`.

La condicion IVA queda persistida con `tax_condition_source = OFFICIAL_DERIVED`, no como carga manual.

## Diagnostico seguro

Cuando la validacion no queda apta, la Edge Function devuelve `ok = false`, un `code` y un objeto `diagnostics` sanitizado. No devuelve token, sign, Authorization, Bearer, certificados, keys ni payload completo sensible en la respuesta HTTP.

Codigos principales:

- `INVALID_TAX_ID`: CUIT localmente invalido.
- `TAXPAYER_NOT_FOUND`: no hubo `personaReturn` ni datos utiles de padron.
- `TAXPAYER_INACTIVE`: `estadoClave` existe y no es `ACTIVO`.
- `TAX_CONDITION_UNKNOWN`: ARCA devolvio datos, pero no impuestos suficientes para derivar IVA.
- `SERVICE_NOT_ENABLED`: falta configuracion, credenciales o permiso del servicio para el CUIT emisor.
- `AFIPSDK_ERROR`: error tecnico de Afip SDK no clasificable.
- `LOOKUP_ENVIRONMENT_MISMATCH`: reservado para inconsistencias explicitas entre ambiente solicitado y configurado.

El diagnostico expone solo campos compactos: ambiente de consulta, ambiente de emision, `wsid`, metodo, CUIT emisor enmascarado, warning prod/dev cuando aplique, presencia de `datosGenerales`, regimen general, impuestos y monotributo, estado CUIT, razon social encontrada, condicion derivada, aptitud futura para Factura A, motivo de normalizacion e impuestos disponibles sanitizados.

En servidor se loguea request id, user id, company id, customer id, CUIT consultado, ambiente, CUIT emisor enmascarado, shape del response, resultado de normalizacion y codigo de error. No se loguean token, sign, Authorization, Bearer, cert, key ni secrets.

## Dev, produccion, certificados, limites

- Dev funciona con Afip SDK si existe `AFIPSDK_ACCESS_TOKEN` y un `issuer_tax_id` habilitado para `ws_sr_constancia_inscripcion` en `billing_settings`. CUIT reales pueden no devolver datos completos en ambiente dev.
- Prod para lookup funciona solo si `CUSTOMER_FISCAL_LOOKUP_ENVIRONMENT=prod` y existe CUIT emisor real por `CUSTOMER_FISCAL_LOOKUP_ISSUER_TAX_ID` o fallback de `billing_settings` del ambiente de emision. No requiere `billing_settings.environment=prod`.
- Si `CUSTOMER_FISCAL_LOOKUP_ENVIRONMENT=prod` y el ambiente de emision sigue en `dev`, la consulta se permite y devuelve warning: `Consulta de padron en produccion. La emision de comprobantes sigue en homologacion/dev.`
- Afip SDK documenta que en desarrollo se puede obtener TA con CUIT `20409378472` sin certificado propio. Para produccion se requiere configuracion/certificado o autorizacion del CUIT representado en Afip SDK/ARCA.
- En produccion debe usarse el mismo `wsid` y metodo con `environment = prod`. Esto solo cambia la consulta de padron: la emision fiscal productiva sigue bloqueada en este cambio.
- Los limites y costos dependen del plan de Afip SDK. El sistema normaliza respuestas 429 como limite/rate limit y no agrega scraping ni API no oficial.

## QA tecnico

Script seguro:

```sh
node scripts/customer-fiscal-lookup-qa.mjs <CUIT> <CUSTOMER_ID>
```

Variables requeridas: `SUPABASE_ACCESS_TOKEN` y `SUPABASE_FUNCTIONS_URL` o `VITE_SUPABASE_URL`. El script imprime `lookupEnvironment`, `taxpayerFound`, flags de response, `taxpayerStatus`, `taxCondition`, `eligibleForInvoiceA`, `normalizationReason` y `code` sin imprimir secrets.

Usar CUIT de homologacion cuando `CUSTOMER_FISCAL_LOOKUP_ENVIRONMENT=dev`. Usar CUIT real solo si `CUSTOMER_FISCAL_LOOKUP_ENVIRONMENT=prod` esta configurado y autorizado por el responsable fiscal. Si no hay CUIT real autorizado, dejar el caso documentado y no declarar exito.

Secrets esperados para staging lookup prod controlado:

- `AFIPSDK_ACCESS_TOKEN`: token de Afip SDK, nunca expuesto en frontend ni logs.
- `AFIPSDK_BASE_URL`: `https://app.afipsdk.com/api/` salvo override controlado.
- `AFIPSDK_ENVIRONMENT`: debe seguir en `dev` para la emision fiscal actual.
- `CUSTOMER_FISCAL_LOOKUP_ENVIRONMENT`: `prod` solo para consulta de padron/constancia.
- `CUSTOMER_FISCAL_LOOKUP_ISSUER_TAX_ID`: `30711582890`.
- `CUSTOMER_FISCAL_LOOKUP_WSID`: `ws_sr_constancia_inscripcion`.

Estado esperado antes y despues de la prueba:

- `billing_settings.environment` de emision sigue en `dev`.
- No se cambia `billing_settings.environment` a `prod`.
- No se emite ningun comprobante.
- No se crean `billing_documents` `FACTURA_A` ni `NOTA_CREDITO_A`.
- Factura B y Nota de Credito B siguen usando su flujo actual en homologacion/dev sin cambios.

Resultado QA staging PR #255:

- `lookupEnvironment=dev`
- `code=TAXPAYER_NOT_FOUND`
- `taxpayerFound=false`
- `taxCondition=UNKNOWN`
- Mensaje: el CUIT no existe en el padron consultado o el ambiente no devolvio datos utiles.

Dictamen: el codigo queda apto tecnicamente. La validacion de CUIT reales queda bloqueada por ambiente dev, porque en `CUSTOMER_FISCAL_LOOKUP_ENVIRONMENT=dev` solo se debe esperar funcionamiento con padron de homologacion. CUIT reales pueden devolver `TAXPAYER_NOT_FOUND` en dev. Para validar CUIT reales se requiere `CUSTOMER_FISCAL_LOOKUP_ENVIRONMENT=prod`, CUIT emisor real y servicio `ws_sr_constancia_inscripcion` habilitado.

Resultado QA real staging PR #256:

- `lookupEnvironment=prod`
- `billingEnvironment=dev`
- `issuerTaxIdMasked=30******890`
- `wsid=ws_sr_constancia_inscripcion`
- `method=getPersona_v2`
- `provider.statusCode=400`
- Error sanitizado asociado a `key/cert`
- Perfil fiscal `ERROR`
- `FACTURA_A` / `NOTA_CREDITO_A`: 0
- `billing_settings.environment` sigue en `dev`

Dictamen PR #256: la separacion lookup prod / emision dev funciona y el CUIT emisor real se toma desde `CUSTOMER_FISCAL_LOOKUP_ISSUER_TAX_ID`. La emision sigue en `dev`, no se habilito Factura A, no se emitieron comprobantes productivos y no se tocaron comprobantes de produccion. La prueba real queda bloqueada funcionalmente por configuracion externa de certificado/relacion/credencial Afip SDK/ARCA para el CUIT `30711582890` y el servicio `ws_sr_constancia_inscripcion`.

## Decision tecnica

Este flujo reemplaza la inferencia anterior basada en endpoints que no exponian claramente la condicion IVA. La condicion no viene como texto final, pero queda derivada de datos oficiales del padron y con fuente explicita. Factura A futura solo puede considerar perfiles con cliente real, CUIT valido, `VALIDATED_AUTO`, `legal_name_source = OFFICIAL`, `tax_condition_source = OFFICIAL_DERIVED`, `tax_condition = RESPONSABLE_INSCRIPTO`, `taxpayer_status = ACTIVO` y razon social oficial presente.

Usar `prod` para consulta de padron no habilita emision de comprobantes productivos. Factura A sigue bloqueada. No se emitio Factura A ni Nota de Credito A, no se toco produccion de comprobantes y Factura B/Nota de Credito B siguen sin cambios.

Checklist proxima fase:

- Configurar certificado/relacion/credencial Afip SDK/ARCA para CUIT emisor `30711582890` y servicio `ws_sr_constancia_inscripcion`.
- Mantener lookup prod de constancia solo para consulta de padron.
- Validar CUIT emisor real `30711582890` de TFD S.R.L.
- Confirmar `ws_sr_constancia_inscripcion` habilitado para el CUIT emisor.
- Repetir QA con el mismo flujo y CUIT real.
- Confirmar `VALIDATED_AUTO`.
- Recien despues avanzar a Factura A homologacion.
