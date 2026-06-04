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
- Ambiente default de Stock Sur: `dev`
- Variable de ambiente: `CUSTOMER_FISCAL_LOOKUP_ENVIRONMENT`, con fallback a `AFIPSDK_ENVIRONMENT`
- CUIT emisor: `billing_settings.issuer_tax_id` para la compania, provider `AFIPSDK`, environment activo

ARCA publica `ws_sr_constancia_inscripcion` como Consulta a Padron Constancia de Inscripcion y aclara que reemplaza a `ws_sr_padron_a5`. `ws_sr_padron_a4` sirve para datos tributarios, pero no es el WS recomendado para constancia actual. `ws_sr_padron_a5` queda descartado por deprecacion/reemplazo.

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

## Datos cubiertos

- Razon social / nombre fiscal: si aparece en `datosGenerales.razonSocial`, `nombre`, `apellido` o campos equivalentes.
- Condicion frente al IVA: no llega como enum directo. Se deriva oficialmente desde `datosMonotributo` y `datosRegimenGeneral.impuesto`.
- Domicilio fiscal: si aparece en `datosGenerales.domicilioFiscal`.
- Estado activo: `datosGenerales.estadoClave`.

La condicion IVA queda persistida con `tax_condition_source = OFFICIAL_DERIVED`, no como carga manual.

## Dev, produccion, certificados, limites

- Dev funciona con Afip SDK si existe `AFIPSDK_ACCESS_TOKEN` y un `issuer_tax_id` habilitado para `ws_sr_constancia_inscripcion` en `billing_settings`.
- Afip SDK documenta que en desarrollo se puede obtener TA con CUIT `20409378472` sin certificado propio. Para produccion se requiere configuracion/certificado o autorizacion del CUIT representado en Afip SDK/ARCA.
- En produccion debe usarse el mismo `wsid` y metodo con `environment = prod`, pero Stock Sur no lo habilita en este cambio.
- Los limites y costos dependen del plan de Afip SDK. El sistema normaliza respuestas 429 como limite/rate limit y no agrega scraping ni API no oficial.

## Decision tecnica

Este flujo reemplaza la inferencia anterior basada en endpoints que no exponian claramente la condicion IVA. La condicion no viene como texto final, pero queda derivada de datos oficiales del padron y con fuente explicita. Factura A futura solo puede considerar perfiles `VALIDATED_AUTO`, `legal_name_source = OFFICIAL`, `tax_condition_source = OFFICIAL_DERIVED` y `RESPONSABLE_INSCRIPTO`.
