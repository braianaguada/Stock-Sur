# Billing production readiness

## Estado actual

- Factura B homologacion/dev validada.
- Nota de Credito B total homologacion/dev validada.
- Impresion interna HTML A4 con QR validada.
- No se usa PDF de Afip SDK.
- Produccion no esta habilitada.
- Factura A, NC A, Nota de Debito, facturacion parcial y libro IVA no estan implementados.

## Antes de produccion

- Confirmar CUIT real del emisor con responsable contable.
- Confirmar razon social, condicion IVA y datos fiscales impresos.
- Habilitar punto de venta real en AFIP/ARCA.
- Configurar AFIPSDK prod solo en Supabase Secrets.
- Validar que `billing_settings.environment = prod` solo pueda activarse desde flujo controlado futuro.
- Hacer backup de base antes de habilitar.
- Monitorear Edge Functions y errores de AFIPSDK.
- Preparar plan rollback.
- Emitir una factura real controlada, no batch inicial.
- Restringir `billing.authorize` a administradores operativos.
- Confirmar numeracion con AFIP/ARCA.
- Confirmar costos de Afip SDK.
- Confirmar responsable contable para validacion final.

## Riesgos

- Doble emision por reintentos mal controlados.
- Numeracion fiscal incorrecta.
- Ambiente prod configurado por error.
- Facturar venta equivocada.
- Nota de Credito fiscal sin devolucion comercial.
- Datos fiscales incompletos.
- Token expuesto.
- Costos del proveedor.
- PDF fiscal con datos legales incompletos.

## Procedimiento futuro sugerido

1. Preparar secrets prod en Supabase.
2. Agregar migracion/configuracion controlada para `environment = prod`.
3. Configurar POS prod.
4. Verificar permisos `billing.authorize` y `billing.settings`.
5. Emitir una factura real controlada.
6. Verificar CAE, QR, numeracion y PDF interno.
7. Monitorear logs y eventos.
8. Recién despues evaluar lote inicial o apertura operativa.

## Prohibiciones vigentes

- No ejecutar `db:push:prod`.
- No usar AFIPSDK prod.
- No guardar tokens/certificados en DB.
- No hardcodear CUIT.
- No exponer secrets.
- No usar PDF de Afip SDK.
