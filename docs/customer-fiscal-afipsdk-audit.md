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
- Variable de ambiente: `CUSTOMER_FISCAL_LOOKUP_ENVIRONMENT`, con fallback a `AFIPSDK_ENVIRONMENT`
- CUIT emisor: `billing_settings.issuer_tax_id` para la compania, provider `AFIPSDK`, environment activo

ARCA publica `ws_sr_constancia_inscripcion` como Consulta a Padron Constancia de Inscripcion y aclara que reemplaza a `ws_sr_padron_a5`. `ws_sr_padron_a4` sirve para datos tributarios, pero no es el WS recomendado para constancia actual. `ws_sr_padron_a5` queda descartado por deprecacion/reemplazo.

La consulta de padron no usa `wsfe`: `wsfe` queda reservado para emision/autorizacion fiscal de comprobantes. Consultar padron en `prod` no implica emitir comprobantes en produccion.

## Request sanitizado

Primero se obtiene token/sign:

```json
{
  "environment": "dev",
  "tax_id": "20409378472",
  "wsid": "ws_sr_constancia_inscripcion"
}
```

Luego se consulta el padron:

```json
{
  "environment": "dev",
  "method": "getPersona_v2",
  "wsid": "ws_sr_constancia_inscripcion",
  "params": {
    "token": "[REDACTED]",
    "sign": "[REDACTED]",
    "cuitRepresentada": 20409378472,
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

El diagnostico expone solo campos compactos: ambiente de consulta, `wsid`, metodo, presencia de `datosGenerales`, regimen general, impuestos y monotributo, estado CUIT, razon social encontrada, condicion derivada, motivo de normalizacion e impuestos disponibles sanitizados.

En servidor se loguea request id, user id, company id, customer id, CUIT consultado, ambiente, CUIT emisor enmascarado, shape del response, resultado de normalizacion y codigo de error. No se loguean token, sign, Authorization, Bearer, cert, key ni secrets.

## Dev, produccion, certificados, limites

- Dev funciona con Afip SDK si existe `AFIPSDK_ACCESS_TOKEN` y un `issuer_tax_id` habilitado para `ws_sr_constancia_inscripcion` en `billing_settings`. CUIT reales pueden no devolver datos completos en ambiente dev.
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

## Decision tecnica

Este flujo reemplaza la inferencia anterior basada en endpoints que no exponian claramente la condicion IVA. La condicion no viene como texto final, pero queda derivada de datos oficiales del padron y con fuente explicita. Factura A futura solo puede considerar perfiles con cliente real, CUIT valido, `VALIDATED_AUTO`, `legal_name_source = OFFICIAL`, `tax_condition_source = OFFICIAL_DERIVED`, `tax_condition = RESPONSABLE_INSCRIPTO`, `taxpayer_status = ACTIVO` y razon social oficial presente.
