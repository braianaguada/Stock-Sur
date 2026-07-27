# Stock Sur

Los remitos internos exigen tecnico y tipo/motivo interno, no admiten cliente, datos fiscales, condicion de venta ni servicio, y nunca generan cuenta corriente ni comprobantes fiscales. Al emitirse mantienen la salida normal de stock.

Plataforma de gestion comercial y operativa para catalogo, stock, documentos, servicios, caja y facturacion.

## Limites de datos de Servicios y Rendiciones

- Documentos de servicio centraliza aceptacion de sugerencias, recursos de impresion y enlaces compartidos en el gateway del feature, con filtros explicitos por `company_id`.
- Rendiciones obtiene el nombre del responsable mediante su gateway; las paginas ya no acceden directamente al cliente de Supabase.
- Las query keys e invalidaciones de documentos quedan acotadas por empresa. No se modifican reglas de negocio, datos, RLS ni esquema y no requiere migraciones.

## Descarga PDF de documentos de servicio

- La descarga autenticada vuelve a obtener la sesion desde el namespace `auth` del cliente de Supabase antes de solicitar el PDF.
- El flujo conserva la autorizacion existente, el guardado nativo cuando esta disponible y la descarga convencional como alternativa.
- La regresion queda cubierta por tests focalizados. No se modifican documentos, permisos, RLS, datos ni esquema, y no requiere migraciones.

## Trazabilidad de migraciones de staging

- Se recupero `supabase/migrations/20260717150000_dashboard_timeseries.sql` desde su commit original y se contrasto con el historial remoto de Supabase.
- El contenido recuperado coincide exactamente con la funcion `public.get_dashboard_timeseries(uuid, text, date, date)` ya desplegada en staging; esta rama solo restaura el archivo faltante en Git y no aplica cambios de esquema ni datos.
- La validacion focalizada de la funcion se ejecuto en una transaccion de solo lectura con rollback. La suite DB critica requiere un rol de prueba autorizado para sembrar `auth.users`; el rol efimero del enlace no cuenta con ese permiso.

## Seguridad de importaciones Excel

- `xlsx` se actualizo de `0.18.5` a `0.20.3` desde el tarball oficial de SheetJS para corregir los advisories de prototype pollution y ReDoS que afectan a la version anterior.
- Se conservan los flujos existentes de lectura `.xlsx` y `.xls`; los parsers general y de catalogos de proveedores mantienen cobertura automatizada.
- No hay cambios de reglas de negocio, datos, permisos, RLS ni aislamiento por `company_id`. Esta remediacion no requiere migraciones.

## Seguridad del pipeline CSS

- `postcss` se actualizo de `8.5.10` a `8.5.22` para corregir el advisory de lectura arbitraria de archivos mediante `sourceMappingURL` controlado por un atacante.
- La remediacion solo modifica la dependencia directa y su lockfile; no cambia estilos, reglas de negocio, datos, permisos, RLS ni aislamiento por `company_id`.
- `npm audit --omit=dev` queda sin vulnerabilidades conocidas. Esta remediacion no requiere migraciones.

## Integridad de consultas operativas

- Cuenta corriente, Trabajos/Servicios y Control de materiales de tecnicos recuperan todos los resultados mediante paginacion, sin topes silenciosos de 300 o 1000 filas.
- Las consultas relacionales con listas de identificadores usan lotes acotados y paginados, con orden estable y conservando los filtros por `company_id`.
- No se modifican datos, reglas de negocio, permisos, RLS ni esquema. Esta remediacion no requiere migraciones.

## Sistema visual transversal

- La gobernanza del rediseño se centraliza en la [Constitución UI](docs/stock-sur-ui-constitution.md), la [arquitectura frontend](docs/frontend-architecture.md), el [catálogo de componentes](docs/component-catalog.md) y el [registro de deprecaciones](docs/deprecations.md).
- El enforcement es incremental: conserva una línea base explícita de consumidores legacy y bloquea su crecimiento mientras cada rollout los elimina.
- Este corte es exclusivamente documental y estructural: no modifica páginas, features, reglas de negocio, consultas, permisos ni base de datos.

- La Constitucion UI de Stock Sur documenta tokens, arquetipos de pagina, contratos de componentes y criterios responsive y accesibles en `docs/stock-sur-ui-constitution.md`.
- El shell alinea navegacion y contenido sobre un ancho operativo unico, incorpora acceso directo al contenido y reserva variantes para paginas estandar, espacios de trabajo y vistas analiticas.
- Tablas, encabezados, filtros, badges, importes y dialogos cuentan con primitivas canonicas y aliases de compatibilidad para una adopcion gradual sin alterar flujos existentes.
- Los paneles analiticos y contenedores operativos pueden contraerse dentro de grillas sin provocar overflow horizontal en mobile; la bandeja de trabajos conserva su selector responsive.
- Este primer PR no agrega migraciones ni modifica reglas de negocio, permisos, consultas o aislamiento multitenant. La QA visual autenticada de los modulos queda como control obligatorio antes de declarar el rediseño completo apto.

## Superficies de compras canónicas

- Catálogos, importaciones, preview PDF, mapping, comparador, bandeja y detalle de órdenes comparten encabezados, filtros, tablas, celdas, badges y acciones del sistema visual global sin perder sus flujos especializados.
- Las importaciones presentan una secuencia operativa clara entre carga, destino, mapping, validación y preview; las confirmaciones permanecen visibles dentro de contenedores con scroll controlado.
- El detalle de órdenes usa la tabla canónica para edición de cantidades e importes, conservando las validaciones y mutations existentes.
- No se agregan migraciones ni se modifican reglas de negocio, permisos, consultas, query keys o aislamiento por empresa.

## Flujos de servicios canónicos

- Trabajos, servicios, tareas y documentos vinculados comparten el workspace, las métricas, filtros, estados y acciones del sistema visual global sin alterar su operación.
- Documentos de servicio usa la tabla, celdas primarias, importes, badges y paginación canónicas; el editor conserva su grilla transaccional especializada.
- Técnicos presenta resumen, bandejas y detalle con superficies canónicas. Rendiciones conserva sus matrices editables específicas y unifica la jerarquía de cabecera, métricas y controles.
- Se preservan permisos, query keys, aislamiento por `company_id`, mutations y reglas de negocio. No requiere migraciones ni cambios de base de datos.

## Flujos comerciales canónicos

- Documentos, su detalle y el registro en Caja comparten encabezado, filtros, tablas, celdas, estados, importes y diálogos canónicos sin modificar emisión ni registración.
- Ventas, gastos, cierres e historial de Caja usan pestañas, resúmenes, badges, acciones y tablas del sistema visual global, conservando sus diferencias operativas.
- Facturación presenta métricas, comprobantes y detalle en un único workspace responsive; Cuenta corriente y cobros conservan su implementación canónica existente.
- Se preservaron permisos, query keys, aislamiento por `company_id`, mutations y reglas de negocio. No requiere migraciones ni cambios de base de datos.

## Compatibilidad de rutas legacy

- `/legacy-catalog-import` se conserva como alias protegido del importador actual en `/items/catalog/import-legacy` para no romper marcadores o accesos antiguos.
- La redireccion preserva parametros de consulta y anclas; su contrato queda cubierto por `App.routes.smoke.test.tsx`.
- `/pending` permanece retirado: el modulo fue eliminado deliberadamente y no se restauro codigo operativo obsoleto.
- No hay migraciones ni cambios en importacion, permisos o datos.

## Catálogo responsive y operativo

- Ítems usa tarjetas compactas en pantallas móviles para evitar la tabla horizontal, manteniendo la tabla configurable y densa en escritorio.
- Cada tarjeta reúne stock, costo base, margen, estado operativo, selección y acciones sin alterar reglas comerciales.
- Los filtros tienen nombres accesibles, pueden restablecerse en una sola acción y los indicadores de stock funcionan con teclado y muestran su selección.
- No hay migraciones ni cambios en consultas, stock, precios o permisos. La regresión responsive está cubierta por `ItemsDataTable.test.tsx`.

## Banco de trabajo responsive para trabajos y servicios

- La bandeja principal incorpora un selector movil sin tabla horizontal y una tabla de escritorio compacta orientada a la operacion.
- Los filtros tienen nombres accesibles, un estado vacio especifico y una accion unica para restablecer la vista activa.
- Los estados usan tonos semanticos compartidos y el detalle permanece disponible durante el recorrido en pantallas amplias.
- No hay migraciones ni cambios en stock, caja, documentos o reglas de negocio. La regresion visual esta cubierta por `ServiceJobs.visual-architecture.test.tsx`.

## Confirmaciones operativas de Documentos

- Emision, devolucion, anulacion, duplicado y cambio de lista usan dialogos consistentes que explican el efecto antes de ejecutar la accion.
- La emision distingue visualmente y por texto los movimientos de stock `OUT` e `IN`; las acciones destructivas tienen una jerarquia de peligro diferenciada.
- La factura externa se carga en un formulario identificado dentro de la aplicacion y quitar su referencia requiere confirmacion explicita.
- No se modificaron permisos, mutations, esquema de base de datos ni la logica existente de stock, caja o cuenta corriente.

## Comparador de proveedores search-first

- El comparador consulta en servidor únicamente las listas seleccionadas, la empresa activa y el texto ingresado; no descarga catálogos completos y limita cada búsqueda a 300 ofertas.
- La bandeja conserva productos entre búsquedas, los agrupa por proveedor y totaliza ARS y USD por separado. Se limpia automáticamente al cambiar de empresa.
- Cada oferta informa su tratamiento de IVA. Si falta o difiere entre ofertas equivalentes, la UI evita declarar un mejor precio y exige revisar la comparación fiscal.
- Migración: `supabase/migrations/20260714120000_supplier_comparison_search_indexes.sql` agrega índices trigram para descripción, código y nombre de producto. No crea órdenes ni movimientos de stock, caja o cuenta corriente.

## Registro de remitos en Caja

- Los remitos emitidos pueden registrarse en Caja desde la tabla o la vista previa, eligiendo unicamente el medio de pago; importe, cliente, fecha operativa y referencia se toman del documento.
- La operacion se valida en DB por empresa activa y permiso `cash.create`, es idempotente y bloquea duplicados activos por referencia. Si existe una factura externa activa se registra esa referencia; en caso contrario se usa el numero de remito.
- Los movimientos con fecha de un cierre ya cerrado quedan posteriores al cierre (`closure_id` nulo) y no lo reabren. Cuenta corriente evita duplicar el debito documental existente.
- Migracion: `supabase/migrations/20260713200000_register_remito_in_cash.sql`.

## Dashboard, documentos y totales

- El dashboard conserva la evolucion mensual de caja y suma una vista de rentabilidad real: venta neta menos impuestos y costo snapshot de productos, excluyendo remitos internos y considerando devoluciones como negativo.
- Los historiales de documentos y presupuestos de servicio incluyen `companyId` en sus query keys de perfiles y la migracion habilita a superadmin a leer nombres de perfiles para auditoria.
- UI ajustada: filas de productos con un unico indicador operativo compacto y detalle en tooltip, descuento general de documentos con menor altura y tarjetas de Totales con color y numeros responsivos.
- Stock evita mostrar busquedas heredadas como `undefined - undefined` al abrir un nuevo movimiento desde un item sin SKU/nombre completo y normaliza visualmente cantidades con ruido decimal de coma flotante.
- Migracion: `supabase/migrations/20260626120000_dashboard_profit_and_profile_names.sql`.

## Selector de empresa activa

- La empresa activa se resuelve desde empresas activas disponibles para el usuario: membresias activas para usuarios normales y empresas activas operables para superadmin.
- Con una sola empresa se selecciona automaticamente y se muestra su nombre sin dropdown. Con varias empresas se muestra el selector en el encabezado, tambien en mobile.
- La empresa recordada se guarda por usuario con `stock-sur.current-company-id.<user_id>`; si deja de ser valida se descarta y se usa la primera empresa activa disponible.
- El cambio seguro valida acceso antes de operar, recarga roles/permisos efectivos, limpia cache dependiente de empresa, redirige a `/` y evita reutilizar datos de la empresa anterior.
- Si el usuario no tiene ninguna empresa activa disponible, la app muestra `Tu usuario no tiene acceso a ninguna empresa activa.` y bloquea los modulos operativos.
- Las empresas inactivas quedan fuera del contexto operativo. La administracion de empresas, miembros y roles se resuelve en una fase separada.
- Esta implementacion mantiene la dependencia legacy de roles globales en `user_roles`; el modelo nuevo por empresa se recarga desde membresias, roles y permisos efectivos.
- Validaciones esperadas para cambios en esta zona: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` y `git diff --check`.

## Rendiciones

Rendiciones queda preparado como modulo generico por empresa, disponible para cualquier empresa activa y aislado por `company_id`.

- Migraciones: `supabase/migrations/20260617120000_settlements_base.sql`, `supabase/migrations/20260617130000_settlements_hardening.sql`, `supabase/migrations/20260617140000_settlements_created_by_nullable.sql` y `supabase/migrations/20260618120000_save_settlement_draft_rpc.sql`.
- Tablas nuevas: `settlements`, `settlement_income_lines` y `settlement_expense_lines`.
- Estados: `DRAFT`, `SUBMITTED`, `RECEIVED` y `CANCELLED`.
- El numero de rendicion es consecutivo por empresa y se asigna al presentar con `submit_settlement`, no al crear el borrador.
- Los ingresos y egresos son cargas manuales propias del modulo. Cliente y proveedor son texto libre; no son relaciones obligatorias.
- Los totales se calculan desde los detalles con `get_settlement_totals`: efectivo, otros medios, totales de ingresos, egresos y total neto de rendicion.
- El frontend no debe enviar totales arbitrarios como fuente de verdad.
- RPCs operativas: `save_settlement_draft`, `submit_settlement`, `receive_settlement` y `cancel_settlement`.
- RLS valida empresa activa, membresia y permisos `settlements.*`; los detalles solo se pueden modificar mientras la rendicion esta en `DRAFT`.
- La UI usa permisos efectivos por empresa para las acciones de Rendiciones; si un permiso esta ausente o denegado, la accion se oculta o bloquea igual que en las RPC/RLS.
- `Recibir` y `Anular` solo se muestran cuando la empresa activa otorga `settlements.receive` o `settlements.cancel`, respectivamente.
- Los campos de presentacion, recepcion y anulacion solo pueden cambiar por RPC; `created_by` de ingresos/egresos se completa obligatoriamente con `auth.uid()` al insertar, queda inmutable para usuarios y se mantiene nullable para respetar los FK `ON DELETE SET NULL`.
- UI operativa: `/settlements` muestra directamente las tablas de ingresos y egresos de la empresa activa, sin selector, historial, ficha de rendicion ni acciones de workflow. Los cambios completos se guardan automaticamente en el borrador operativo.
- Cada tabla tiene su propia accion primaria: `Nuevo ingreso` y `Nuevo egreso` abren formularios modales y agregan filas compactas de solo lectura; eliminar una fila exige confirmacion.
- El autoguardado mantiene tablas y totales visibles mientras persiste los cambios, sin reemplazar la vista por un estado de carga.
- La impresion pagina listados extensos, repite encabezados y ubica el bloque indivisible de observaciones, totales y firma al pie de la hoja actual o de una hoja final.
- Las tablas de ingresos y egresos usan la paginacion estandar del sistema de forma independiente; filtros, totales e impresion consideran todas las filas correspondientes.
- La impresion permite elegir periodo o rango, agregar una nota para la hoja y usa el logo configurado para la empresa, con marca generica como respaldo. Observaciones, totales y recepcion quedan al pie de la hoja.
- El detalle separa ingresos y egresos con sus columnas operativas, altas independientes, filtro por fecha y totales sobre las filas visibles. La impresion A4 apaisada usa solo datos persistidos, permite elegir todo, el periodo de la rendicion o una fecha/rango personalizado, e incluye encabezado, cantidades, totales, observaciones y recepcion con firma, aclaracion y fecha.
- La pantalla usa un flujo vertical de ancho completo: selector compacto de rendicion, totales, encabezado y tablas separadas de ingresos y egresos.
- Las query keys de Rendiciones siempre incluyen `companyId` y el cambio de empresa o rendicion limpia seleccion, encabezado y lineas locales para no reutilizar datos de otro contexto.
- Mientras hay guardado o workflow pendiente, la UI bloquea edicion, seleccion de otra rendicion y acciones para evitar estados cruzados.
- El guardado de borrador usa `save_settlement_draft` para persistir encabezado, ingresos y egresos en una sola transaccion; la base deriva empresa y usuario autenticado.
- La UI bloquea la edicion fuera de `DRAFT`; los cambios de workflow usan exclusivamente las RPCs `submit_settlement`, `receive_settlement` y `cancel_settlement`.
- El modulo no lee, crea ni modifica Caja, ventas, gastos de Caja, cierres, Totales, cuenta corriente, documentos, stock, trabajos ni facturacion.
- Origen verificado de `supabase/migrations/20260616150000_active_company_operational_guards.sql`: commit `de4b985 Harden active company operational guards`; el diff normalizado contra ese commit no tiene cambios locales. En staging, `npx supabase migration list --linked` muestra aplicada la version `20260616150000` con fecha `2026-06-16 15:00:00`.

## Configuracion por empresa

- `supabase/migrations/20260624183000_restore_global_admin_company_permissions.sql` alinea RLS con la UI y restaura permisos efectivos de administradores globales sobre empresas activas. Esto permite guardar tema y configuracion sin ampliar acceso a empresas inactivas.
- El reemplazo del logo agrega una version a la URL publica para evitar que navegador o CDN sigan mostrando la imagen anterior. La carga valida que sea una imagen de hasta 5 MB.

## Desarrollo local

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd Stock-Sur

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Documentacion de UI

- [Sistema visual inicial](docs/UI_SYSTEM.md): auditoria visual, navegacion, componentes base y piloto de Caja.
- Estado de cuenta prioriza el saldo acumulado, separa deuda vencida/no vencida y pagos, y presenta los movimientos en una tabla operativa con conteo y estados explicitos de carga, vacio y error. No cambia calculos ni consultas.
- Fix de documentos: los combos se expanden a productos reales usando el mismo detalle de linea que la carga manual, conservando cantidades acumuladas y precios manuales existentes.
- Destinatarios de presupuestos y remitos: seleccion simplificada entre cliente ocasional y registrado; Persona/Empresa queda pendiente de un campo confiable en `customers`.

## Clientes fiscales para Factura A futura

Clientes soporta un perfil fiscal separado en `customer_fiscal_profiles` para preparar una futura Factura A sin emitirla todavia. Factura B y Nota de Credito B siguen en homologacion/dev como Consumidor Final automatico.

- El perfil fiscal guarda CUIT normalizado, razon social, condicion IVA, domicilio fiscal, estado de clave, fuentes de datos, metadata sanitizada y fecha de validacion.
- El CUIT se valida por formato de 11 digitos y digito verificador; la UI permite guiones o espacios, pero persiste solo digitos.
- La validacion automatica usa la Edge Function `customer-fiscal-lookup` con AFIPSDK REST, `ws_sr_constancia_inscripcion/getPersona_v2` y `CUSTOMER_FISCAL_LOOKUP_ENVIRONMENT` (`dev` o `prod`) cuando hay secrets disponibles. No usa `wsfe` ni `ws_sr_padron_a5` para esta consulta.
- `CUSTOMER_FISCAL_LOOKUP_ENVIRONMENT` solo controla consulta de padron. El ambiente de emision fiscal sigue separado y Factura B/Nota de Credito B continuan limitadas a homologacion/dev.
- En `CUSTOMER_FISCAL_LOOKUP_ENVIRONMENT=dev` solo se debe esperar funcionamiento con padron de homologacion. CUIT reales pueden devolver `TAXPAYER_NOT_FOUND` porque el ambiente no devuelve datos utiles para ese contribuyente.
- Para validar CUIT reales se requiere `CUSTOMER_FISCAL_LOOKUP_ENVIRONMENT=prod` con CUIT emisor real autorizado para `ws_sr_constancia_inscripcion`. El CUIT emisor de lookup puede venir de `CUSTOMER_FISCAL_LOOKUP_ISSUER_TAX_ID`; si falta, cae a `billing_settings.issuer_tax_id` del ambiente de emision actual.
- Variables de lookup controlado en staging: `CUSTOMER_FISCAL_LOOKUP_ENVIRONMENT=prod`, `CUSTOMER_FISCAL_LOOKUP_ISSUER_TAX_ID=30711582890` y `CUSTOMER_FISCAL_LOOKUP_WSID=ws_sr_constancia_inscripcion`. Esto solo consulta constancia/padron.
- `CUSTOMER_FISCAL_LOOKUP_ENVIRONMENT` esta separado del ambiente de emision fiscal. La emision debe seguir en `billing_settings.environment=dev`; no cambiarla a `prod` para esta prueba.
- Usar `prod` para consulta de padron no habilita emision de comprobantes productivos. No implementa Factura A, no emite Factura A, no emite Nota de Credito A y no toca comprobantes productivos.
- Si AFIPSDK no devuelve datos inferibles o falla, el perfil queda en `ERROR`; no se marca como validado y la UI muestra diagnostico compacto: ambiente, fuente, presencia de datos generales/regimen/impuestos/monotributo, estado CUIT, codigo y motivo.
- Si no hay razon social oficial, `legal_name` queda vacio y `legal_name_source = UNKNOWN`; no se rellena con CUIT, nombre comercial ni datos viejos.
- Factura A futura solo queda apta para cliente registrado, CUIT valido, razon social oficial, estado CUIT `ACTIVO`, condicion IVA `RESPONSABLE_INSCRIPTO` derivada oficialmente y perfil `VALIDATED_AUTO`.
- No se guardan tokens, Authorization, certificados, private keys ni secrets en DB; las respuestas del proveedor se sanitizan antes de persistirse.
- QA tecnico seguro: `node scripts/customer-fiscal-lookup-qa.mjs <CUIT> <CUSTOMER_ID>` con `SUPABASE_ACCESS_TOKEN` y `SUPABASE_FUNCTIONS_URL`/`VITE_SUPABASE_URL`. El script imprime solo diagnostico compacto y no secrets.
- Cliente ocasional / Consumidor Final se representa por `customer_id = null`: no se crea ni edita desde Clientes, no tiene perfil fiscal, CUIT, Factura A ni cuenta corriente editable.
- QA staging PR #255: el codigo quedo apto tecnicamente. Con `lookupEnvironment=dev`, un CUIT real devolvio `TAXPAYER_NOT_FOUND`, `taxpayerFound=false`, `taxCondition=UNKNOWN`; la validacion de CUIT reales queda bloqueada por ambiente dev, no por normalizacion/UI.
- QA real PR #256: la separacion lookup prod / emision dev funciona. La prueba devolvio `lookupEnvironment=prod`, `billingEnvironment=dev`, `issuerTaxIdMasked=30******890`, `wsid=ws_sr_constancia_inscripcion`, `method=getPersona_v2`, `provider.statusCode=400`, perfil fiscal `ERROR` y error sanitizado asociado a `key/cert`. Dictamen: apto tecnicamente para merge a staging, bloqueado funcionalmente por configuracion externa de certificado/relacion/credencial Afip SDK/ARCA para `ws_sr_constancia_inscripcion`.
- Esta fase no toca produccion, caja, stock, cuenta corriente ni autorizacion fiscal de Factura A. No se emitio Factura A ni Nota de Credito A, no se tocaron comprobantes productivos y Factura B/Nota de Credito B siguen sin cambios.

Proxima fase para CUIT reales y Factura A de homologacion:

- Configurar certificado/relacion/credencial Afip SDK/ARCA para CUIT emisor `30711582890` y servicio `ws_sr_constancia_inscripcion`.
- Mantener lookup prod de constancia solo para consulta de padron.
- Validar CUIT emisor real `30711582890` de TFD S.R.L.
- Confirmar `ws_sr_constancia_inscripcion` habilitado para el CUIT emisor.
- Repetir QA con el mismo flujo y CUIT real.
- Confirmar `VALIDATED_AUTO`.
- Recien despues avanzar a Factura A en homologacion.

## Tecnicos: Control de materiales

La vista `/technicians` incluye la tab **Control de materiales** para cierre operativo de servicios. Es un informe de solo lectura sobre remitos y devoluciones vinculados a tecnicos; no representa deuda, cobranza ni cuenta corriente del tecnico.

- Los tecnicos tienen estado **Activo/Inactivo**. Los inactivos se mantienen visibles en reportes historicos, pero no aparecen como opcion principal para nuevos remitos o servicios.
- La eliminacion fisica solo se permite cuando el tecnico no tiene historial. Si existen documentos (`documents.technician_id`) o asignaciones de servicios (`service_job_service_technicians.technician_id`), la base bloquea el borrado y la UI permite marcarlo como Inactivo.
- **Valor materiales entregados**: suma de lineas de documentos `REMITO` asociados a tecnicos dentro del periodo filtrado. Usa `document_lines.line_total`; si no existe, usa `quantity * unit_price`; si no hay lineas suficientes, el valor de materiales queda en 0.
- **Valor materiales devueltos**: suma de lineas de `REMITO_DEVOLUCION` asociados al mismo flujo operativo, con el mismo criterio de lineas.
- **Balance de materiales**: `Valor materiales entregados - Valor materiales devueltos`.
- **Valor comercial**: toma `documents.total` y se muestra separado del valor de materiales porque puede diferir de la suma de lineas.
- **Balance comercial**: `Total comercial entregado - Total comercial devuelto`.
- **Costo estimado**: usa `document_lines.base_cost_snapshot * quantity`; si no hay costo historico confiable, queda en 0.
- **Margen bruto estimado**: `Valor comercial neto - Costo estimado neto`. No se presenta como ganancia porque no descuenta mano de obra, viaticos, gastos, impuestos ni otros costos.
- **Devoluciones vinculadas**: se infieren por `documents.origin_document_id` contra el remito original y por `technician_id`; tambien se muestra `source_document_id` cuando existe como referencia de origen.
- **Trabajos vinculados**: se leen desde `documents.service_id` hacia `service_job_services` y `service_jobs`.
- **Materiales agrupados**: se agrupan por `item_id` cuando existe; si no, por SKU y descripcion. Muestran cantidades, valores de materiales, costo neto y margen estimado por material.

Filtros disponibles: tecnico, rango rapido (hoy, esta semana, este mes, mes anterior o personalizado), fecha desde/hasta, cliente/empresa, trabajo/servicio, tipo de documento y busqueda por numero de remito, factura externa, cliente, tecnico o producto/material.

La tabla principal es **Movimientos por tecnico** y resume remitos, devoluciones, valor comercial, costo estimado, margen bruto estimado, balance de materiales, clientes y trabajos. El detalle por tecnico separa Comercial, Costos, Resultado y Materiales. La accion **Imprimir movimientos** genera una vista A4 del periodo filtrado con resumen y movimientos detallados, ocultando acciones operativas.

No se crean movimientos de stock, documentos, ventas de caja, gastos, entradas de cuenta corriente, trabajos ni servicios al navegar o filtrar esta vista.

## REMITO_DEVOLUCION integral

`REMITO_DEVOLUCION` funciona como documento espejo del `REMITO` original: guarda `origin_document_id`, no modifica el remito de origen, emite movimientos de stock `IN` y se anula con la reversa de stock correspondiente.

- Al generarlo desde un remito interno, el borrador conserva tecnico, origen, trazabilidad y cantidades, pero normaliza los campos exclusivos del remito (`customer_kind`, `internal_remito_type` y datos comerciales) para respetar las validaciones de destinatario de la devolucion. No requiere migracion y no emite stock hasta la emision del documento.

- En Caja se registra como **Devolucion / Remito devolucion** con medio fijo `SERVICIOS_REMITO`, importe operativo negativo y tabla `cash_adjustments`. No se guarda en `cash_sales`, no se registra como gasto y no modifica caja ni cierre original.
- En Cuenta Corriente genera `CREDIT` solo si el remito original era elegible para `DEBIT`: cliente registrado no ocasional, `customer_id` valido y `payment_terms = CUENTA_CORRIENTE`. Clientes ocasionales o sin cliente no generan cuenta corriente. Al anular una devolucion emitida se registra la reversa correspondiente.
- En Tecnicos / Control de materiales resta cantidades, valor comercial, costo estimado y margen estimado. Es control operativo de materiales; no crea cuenta monetaria del tecnico.
- En Totales y cierres baja el total operativo de Servicio / Remito con signo negativo y no contamina el efectivo a rendir cuando `SERVICIOS_REMITO` no lo hace.
- En impresion de devolucion se muestra la referencia al remito origen y se oculta la metadata de `Descuento de sueldo`.

Validaciones ejecutadas para esta integracion: `npm run db:push:staging`, `npx tsc --noEmit`, `npm run lint`, `npm run test` y `npm run build`.

## Presupuestos de servicio profesionales

Los presupuestos de servicio soportan adjuntos, moneda y links publicos sin mezclar este flujo con stock, caja, cuenta corriente ni tecnicos.

- **Imagenes / referencias**: se guardan en Storage en el bucket privado `service-document-attachments`, nunca en base64. Cada imagen puede tener titulo, descripcion, orden y marca `Mostrar en impresion`. Solo las marcadas aparecen en impresion y vista publica.
- **Moneda ARS/USD**: ARS mantiene el comportamiento historico. USD guarda cotizacion, fecha, fuente y etiqueta como snapshot del documento para que presupuestos historicos no cambien por cotizaciones futuras.
- **Cotizacion BNA**: la UI intenta obtener cotizacion de Banco Nacion desde una capa aislada. Si falla, permite cargar cotizacion manual y guarda `source = MANUAL`.
- **Modo de precio**: `DETAILED` mantiene precios por linea. `GLOBAL_TOTAL` permite lineas descriptivas sin precio unitario y muestra solo el precio final global en UI comercial, impresion y vista publica.
- **Links publicos**: se generan tokens largos no predecibles en `service_document_share_links`. El link no expone ids internos, es revocable y puede expirar. La vista publica es de solo lectura y no requiere login.
- **PDF**: los presupuestos de servicio reutilizan exactamente el HTML de impresion desde el listado y desde el link publico. Un endpoint autenticado lo renderiza con Chromium y el boton abre directamente el selector de ubicacion para guardar el `.pdf` en navegadores compatibles; si el navegador no soporta ese selector, inicia una descarga normal.
- **WhatsApp/email**: fase 1 comparte el link publico por `wa.me` o `mailto`. No adjunta PDF automaticamente, no usa proveedor de email y no usa WhatsApp Business API.

Limitaciones actuales: el envio real de email con adjunto, historial de envios y WhatsApp Business API quedan fuera de esta fase.

### Compartir documentos comerciales

- Presupuestos y remitos generan un link publico revocable para compartir por WhatsApp, con vista del documento y descarga directa en PDF.
- El payload publico expone solamente los datos impresos; no publica IDs internos, costos ni metadatos operativos.
- Las notas de presupuestos y remitos tienen mayor contraste, borde y tipografia en la vista de impresion.
- Migracion: `20260625150000_document_public_share_links.sql`.

## Documentos y estado de cuenta

La vista previa y la impresion de documentos comerciales y presupuestos de servicio amplian el area util del logo de empresa para mejorar legibilidad sin cambiar movimientos de stock, caja, cuenta corriente ni facturacion.

Los links publicos de presupuestos/remitos comerciales dependen de las migraciones existentes `20260625150000_document_public_share_links.sql` y `20260625190000_fix_document_share_token_generation.sql`. La carga de clientes con dias de vencimiento depende de `20260625120000_customer_account_due_days.sql`.

Estado de cuenta lee `account_due_days` del cliente para calcular vencimientos cuando el asiento no trae `payment_term_days` explicito, y su cache de React Query queda segmentada por filtros para evitar resultados reutilizados entre busquedas.

## Estado actual de staging

### Base de abastecimiento: proveedores y listas

- Proveedores incorpora razon social, CUIT normalizado, telefono y WhatsApp independientes y direccion. La moneda no se solicita ni se clasifica por proveedor.
- Cada oferta importada conserva su propia moneda (`ARS` o `USD`), por lo que una lista puede ser ARS, USD o mixta. La deteccion prioriza celda de precio, columna de moneda y encabezado; los conflictos requieren revision y, sin evidencia, se usa ARS.
- El preview permite corregir moneda por fila. Catalogo y bandeja de seleccion usan layouts adaptables sin megatablas horizontales.
- `price_lists` sigue siendo el dominio de precios internos de venta; abastecimiento reutiliza `supplier_catalogs`, `supplier_catalog_versions` y `supplier_catalog_lines`.
- Las migraciones `20260711120000_procurement_supplier_list_foundation.sql` y `20260711150000_supplier_offer_currency_per_line.sql` son aditivas. La segunda canoniza y valida moneda por linea, preserva los campos legacy y no los usa como fallback operativo.
- La importacion PDF permite revisar el documento real junto a las lineas detectadas, navegar paginas y zoom, y confirmar por linea si el costo incluye IVA, no lo incluye o no fue informado.
- El tratamiento de IVA se conserva en `supplier_catalog_lines.tax_treatment`; las leyendas ambiguas quedan como `UNKNOWN` para evitar recalculos implicitos.
- La migracion `20260713220000_supplier_catalog_line_tax_treatment.sql` agrega el dato impositivo y lo valida dentro del RPC de importacion, manteniendo los controles de empresa y permisos existentes.
- Abastecimiento incluye comparacion de ofertas y ordenes de compra persistidas. La confirmacion de una orden no genera por si sola movimientos de stock, Caja ni cuenta corriente.

`staging` es la rama de QA/demo donde se prueban los cambios antes de promoverlos a `main`.
Al 2026-05-11, los cambios principales incorporados en `staging` son:

- Fix critico de cuenta corriente en proceso:
  - se restaura la generacion de `DEBIT` para remitos emitidos y ventas de caja con `CUENTA_CORRIENTE`
  - se agrega idempotencia para evitar duplicados por reintento
  - se restaura el flujo completo de `issue_document` para no romper stock, devoluciones, numeracion ni eventos al agregar el `DEBIT`
  - se corrige la condicion documental: `DEBIT` solo se genera para `REMITO` con `payment_terms = 'CUENTA_CORRIENTE'`, cliente identificado no ocasional y total positivo
  - migraciones aplicadas en staging; queda pendiente QA transaccional manual de negocio con credenciales DB/usuario real

- Redisenio completo de impresion/PDF para documentos comerciales:
  - `PRESUPUESTO`
  - `REMITO`
  - `REMITO_DEVOLUCION`
- Redisenio completo de impresion/PDF para documentos de servicio:
  - presupuesto de servicio
  - remito de servicio
- Layout A4 modernizado:
  - encabezado compacto con logo y datos de empresa
  - bloque de tipo, numero, fecha y estado
  - datos de cliente/operacion mejor distribuidos
  - notas separadas de la zona de firma
  - tabla de productos/items mas compacta
  - totales visualmente diferenciados
  - footer documental
- Mejoras de impresion:
  - uso de `@media print`
  - mejor manejo de saltos de pagina
  - filas mas compactas
  - mejor aprovechamiento de hoja A4
  - boton de impresion fuera del area imprimible
- Vistas previas modernizadas:
  - documento comercial
  - presupuesto/remito de servicio
  - hoja centrada con fondo neutro
  - barra inferior con acciones `Cerrar` y `Abrir impresion`
  - boton de cierre corregido para tema oscuro
  - tabla con encabezado oscuro en linea con servicios
- Historial redisenado en previews:
  - timeline visual
  - iconos por tipo de evento
  - colores por severidad/estado
  - resumen de estado actual y fecha de creacion
  - nombre del usuario cuando esta disponible en `profiles`
  - fallback a `Sistema` o `Usuario sin nombre`
- Duplicado operativo de documentos comerciales:
  - disponible para `PRESUPUESTO` y `REMITO` desde tabla y vista previa
  - crea un nuevo `BORRADOR` con cliente, tecnico, snapshots fiscales, condiciones, lista de precios, notas, lineas, precios y snapshots de pricing
  - resetea numeracion, factura externa, estado emitido/aprobado, eventos previos y vinculos operativos
  - no genera stock, caja ni cuenta corriente
  - no esta disponible para `REMITO_DEVOLUCION`
  - agrega trazabilidad con `source_document_id`, `source_document_type`, `source_document_number_snapshot` y evento `DUPLICATED_FROM_DOCUMENT`
- Redondeo configurable de precios para documentos:
  - se configura por empresa desde **Configuracion > Redondeo de precios**
  - permite desactivar redondeo o redondear el precio sugerido a multiplos de 100, 500 o 1000
  - documentos usan el precio operativo redondeado al cargar productos y al normalizar nuevas lineas antes de guardar
  - consultas de listas de precios y productos muestran el mismo precio operativo redondeado como ayuda visual
  - mantiene visible/accesible el precio exacto original con badge/tooltip `Redondeado desde $X`
  - no modifica costos base, precios importados, `price_list_items`, listas originales ni snapshots de porcentajes
  - el usuario puede seguir cambiando el precio manualmente; ese override se respeta
  - cuando una linea nueva queda redondeada, el editor muestra un badge discreto `Redondeado` con el sugerido original en el tooltip
- Precios personalizados por producto/lista:
  - cada fila de `price_list_items` puede activar `manual_price_enabled` y usar `final_price_override` como precio operativo final
  - prioridad de precios: 1) precio manual editado en el documento, 2) precio personalizado del producto en esa lista, 3) precio calculado por formula, 4) fallback sin precio
  - el precio personalizado se respeta exacto y no se redondea automaticamente; el redondeo operativo sigue aplicando solo para precios calculados por formula
  - el precio calculado y el costo base no se borran; quedan como referencia para margen, tooltip y vuelta a formula
  - recalcular una lista actualiza `calculated_price` pero conserva el override activo, nota y metadata
  - migracion: `supabase/migrations/20260516120000_price_list_product_overrides.sql`
- Combos de productos v1:
  - nueva ruta `/combos` para crear combos reutilizables por empresa
  - CRUD mejorado con edicion de cabecera, activacion/desactivacion y editor de lineas
  - formulario estable: no se pisa al tipear ni al refetch de queries mientras se edita, y al seleccionar un combo existente espera a cargar sus lineas antes de hidratar el formulario
  - si hay cambios locales sin guardar, cambiar de combo o limpiar pide confirmacion antes de descartar
  - cada combo agrupa productos reales con cantidades, notas y orden simple
  - en documentos, el buscador permite agregar combos con multiplicador y se expanden a lineas reales
  - si el mismo combo se agrega varias veces en un documento, las lineas se consolidan por `item_id` y solo se suma cantidad; no se duplican filas ni se pisa un precio manual existente
  - no existe stock propio ni precio propio del combo en esta fase
  - la logica de documentos sigue aplicando precios, redondeo y edicion manual por linea
- Guardado atómico de combos:
  - `/combos` guarda cabecera + lineas con la RPC `upsert_product_combo_with_lines`
  - si falla una validacion o una linea, la operacion se revierte completa en Supabase
  - al editar, se reemplaza el set de lineas dentro de la misma transaccion
  - al guardar se invalidan queries de combos y lineas para refrescar cards, resumenes y badges sin recargar la pagina
- Gastos de caja v1:
  - Caja incorpora una pestania `Gastos` para registrar egresos operativos por fecha de caja
  - se reutiliza `cash_expenses` vinculada por `company_id + business_date`; no hay `cash_session_id` porque el modelo actual usa `cash_closures`
  - cada gasto tiene categoria controlada, descripcion, monto, medio (`CAJA` o `CUENTA_CORRIENTE`), comprobante opcional, referencia y notas
  - no hay borrado fisico: la accion disponible es anular, via RPC `cancel_cash_expense`
  - los gastos activos de tipo `CAJA` descuentan del efectivo esperado; los no efectivo se muestran como egreso pero no reducen el efectivo fisico
  - el cierre muestra gastos en efectivo, gastos no efectivo y efectivo neto esperado
  - no genera stock, documentos, cuenta corriente ni movimientos de inventario
- Totales de caja por periodo v1:
  - nueva ruta `/cash-totals`, accesible desde la navegacion como `Totales`
  - permite consultar por dia, semana, mes o rango personalizado usando fecha operativa
  - muestra resumen del periodo: total vendido, efectivo bruto, gastos efectivo, efectivo neto, cuenta corriente y gastos totales
  - agrupa por dia con columnas de efectivo, transferencia, Point/MP, cuenta corriente, servicios/otros, gastos efectivo, gastos no efectivo, total ventas y efectivo neto
  - reutiliza `cash_sales` y `cash_expenses` con consultas batch por rango; no se agrego RPC ni migracion en esta fase
  - ventas anuladas y gastos anulados no suman; gastos efectivo reducen caja fisica y gastos no efectivo solo se informan como egreso
- Estado de cuenta operativo v1:
  - nueva ruta `/customer-account`, accesible desde la navegacion como `Estado de cuenta`
  - acceso directo desde la cuenta corriente de cada cliente en `Clientes` con filtro `customerId`
  - filtros por cliente, rango de fechas, estado y busqueda por factura/remito/referencia
  - cards superiores para saldo total, deuda vencida, deuda no vencida y pagos del periodo
  - tabla con fecha, vencimiento estimado, cliente, origen, referencia, descripcion, debito, credito, saldo y estado visual
  - las fechas de negocio `YYYY-MM-DD` se muestran con `formatBusinessDate` para evitar corrimientos por parseo UTC
  - muestra cobros manuales `CREDIT` como pagos separados sin imputarlos aun a facturas/remitos
  - usa `document_id`, `cash_sale_id`, metadata y join con `documents` para mostrar remito/factura externa cuando existe
  - si un documento no tiene factura externa asociada, mantiene la referencia de remito/documento sin romper la vista
  - no incluye cliente ocasional ni mezcla empresas: las consultas filtran por `company_id` y clientes no ocasionales
  - el vencimiento es estimado: `metadata.due_date` si existe; si no, debitos a 30 dias desde fecha de documento/movimiento; creditos quedan sin vencimiento
  - estado por movimiento es estimado hasta incorporar imputacion formal de pagos por documento
- Trabajos / Servicios base v1:
  - nueva ruta `/service-jobs`, accesible desde la navegacion como `Trabajos`
  - el modulo `/technicians` queda accesible desde la navegacion principal como `Tecnicos`, ubicado junto a `Trabajos`
  - la pantalla de tecnicos permite listar, buscar, crear, editar y eliminar tecnicos usando la tabla `technicians`; Documentos, Trabajos y Servicios consumen la misma entidad
  - permisos: se mantiene el acceso operativo protegido por sesion/empresa igual que el resto de rutas internas; no se agregan permisos complejos nuevos en esta fase
  - modelo base para trabajos generales por empresa y cliente, con estado, prioridad, descripcion, apertura/cierre y auditoria minima
  - modelo base para servicios dentro de un trabajo, con fecha/hora programada, estado, tareas realizadas, notas y tecnicos asignados
  - relacion `service_job_service_technicians` para asignar multiples tecnicos a cada servicio sin duplicar el mismo tecnico en el mismo servicio
  - listado con busqueda por trabajo/cliente, filtro por estado, tecnico y rango de apertura
  - detalle lateral de trabajo con servicios asociados y CRUD minimo de trabajos/servicios
  - no registra materiales, no vincula remitos, no crea remitos y no genera stock, caja, documentos, facturacion ni cuenta corriente
  - los trabajos bloquean clientes ocasionales en la migracion y la UI solo lista clientes regulares
  - RLS usa permisos existentes `customers.view`, `customers.create` y `customers.edit` por cercania funcional con clientes/tecnicos hasta crear permisos especificos de trabajos
  - se corrigio la hidratacion de sesion para que una ruta protegida como `/service-jobs` cargue directo por URL sin rebotar al dashboard
- Vinculacion de remitos de materiales a servicios v1:
  - `documents.service_id` permite asociar remitos actuales del modulo Documentos con servicios de Trabajos
  - solo `REMITO` puede guardar `service_id`; `PRESUPUESTO` y `REMITO_DEVOLUCION` quedan bloqueados por validacion de DB/UI
  - el trigger valida que documento y servicio pertenezcan a la misma empresa y al mismo cliente registrado; bloquea remitos internos, ocasionales, sin cliente o trabajos/servicios sin cliente
  - desde el detalle de servicio se puede crear un `REMITO` `BORRADOR` vinculado, con cliente del trabajo y tecnico automatico solo si el servicio tiene un unico tecnico
  - desde el detalle de servicio se pueden vincular y desvincular remitos existentes sin borrar documentos ni generar movimientos de stock
  - los servicios muestran remitos asociados con numero, estado, fecha, tecnico, lineas, total y costo estimado por snapshots de lineas
  - el editor de Documentos muestra el campo opcional `Servicio asociado` solo para `REMITO`, filtrado por cliente cuando aplica; con servicio vinculado bloquea el cambio de cliente hasta desvincular
  - la vista previa de Documentos muestra el trabajo/servicio asociado y link de vuelta a `/service-jobs?serviceId=<id>`
  - emitir remitos sigue usando el flujo existente de Documentos; crear/vincular/desvincular no emite ni mueve stock
- Control operativo de trabajos/servicios:
  - `/service-jobs` suma un resumen superior con trabajos abiertos/en curso/finalizados, servicios pendientes/realizados y costo estimado de materiales del periodo filtrado
  - la lista operativa muestra cliente, estado, prioridad, cantidad y avance de servicios, tecnicos involucrados, remitos vinculados, lineas, costo estimado y ultima actividad
  - los filtros mantienen busqueda, estado, tecnico y periodo, y agregan prioridad sin cambiar reglas de negocio
  - el detalle del trabajo muestra totales de servicios, remitos, total documental y costo estimado antes del desglose por servicio
  - no agrega facturacion, cuenta corriente, calendario, adjuntos, exportacion ni rentabilidad avanzada
- Archivo y eliminacion segura de trabajos:
  - `service_jobs` incorpora `archived_at` y `archived_by` para separar archivo de borrado fisico
  - `/service-jobs` oculta archivados por defecto y agrega filtro `Activos / Archivados / Todos`
  - cada trabajo puede archivarse con confirmacion y restaurarse sin tocar servicios, remitos, documentos, stock ni caja
  - la UI muestra badge `Archivado` y bloquea acciones operativas basicas mientras el trabajo siga archivado
  - la eliminacion fisica queda reservada a trabajos vacios; si tiene servicios o remitos/documentos vinculados se bloquea con mensaje claro
  - se agrega la migracion `20260514113000_service_jobs_archive_and_safe_delete.sql`, aplicada en `staging` con `npm run db:push:staging`
- Limpieza visual de Listas de precios:
  - la pestania `Listas` vuelve a priorizar `Listas configuradas` y saca de la UI la tabla grande de consulta rapida
  - se mantienen busqueda, estado, flete/margen/IVA, cantidad de productos, pendientes, ultimo recalculo y acciones `Ver lista` + `Recalcular`
  - si la pantalla llega con `?itemId=`, se muestra un aviso simple y una accion para abrir la lista sugerida sin romper la navegacion desde Productos
  - no modifica formulas de precio, redondeo, importaciones, snapshots, documentos ni stock
- UX operativa de combos:
  - `/combos` reemplaza el selector gigante por busqueda de productos activos por SKU, nombre, marca o categoria
  - agregar productos crea lineas claras con cantidad, unidad, notas y accion de quitar, y bloquea duplicados desde la UI
  - se mantienen las validaciones de nombre, lineas, cantidad mayor a cero y payload transaccional hacia `upsert_product_combo_with_lines`
  - mientras se edita un combo seleccionado, su card/listado usa el estado local del formulario para reflejar cantidades y notas al instante, sin perder foco ni esperar un refetch
- QA integral y hardening operativo:
  - se auditaron por codigo/tests los flujos de productos, precios/redondeo, combos, documentos, devoluciones, caja/gastos/totales, cuenta corriente y trabajos/servicios
  - `/price-lists?itemId=<id>` ahora prioriza automaticamente la lista que contiene el producto destacado antes de caer en la primera lista disponible
  - `/customer-account?customerId=<id>` y el alias legado `customer_id` se resincronizan si el query param cambia con la pantalla ya montada
  - los combos vacios quedan cubiertos para confirmar que no generan lineas sinteticas ni stock por si mismos
  - QA manual final detecto y corrigio `/technicians`, que caia en el error boundary por referencias incompletas a `saveMutation`/`deleteMutation`
  - no se agregaron nuevos modulos, reglas de negocio, escrituras automaticas ni cambios grandes de UX
- QA visual y consistencia de UI:
  - se revisaron las pantallas principales de operacion: inicio, productos, combos, stock, proveedores, listas de precios, documentos, caja, totales, clientes, cuenta corriente, tecnicos y trabajos/servicios
  - se compacto el badge base para evitar filas infladas por estados dentro de tablas y mejorar contraste/lectura en modo claro y oscuro
  - se agregaron helpers compartidos para acciones de fila y estados vacios de tabla, aplicados en productos, clientes, proveedores, tecnicos y trabajos/servicios
  - las acciones de tabla quedan con tamano, radio, tooltip/aria-label y tonos visuales consistentes para ver, editar, reactivar/desactivar, eliminar y desvincular
- Validaciones ejecutadas para archivo de trabajos:
  - `npm run db:push:staging`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
- Limitaciones pendientes:
  - el bloqueo fuerte de borrado fisico se apoya en trigger de base; no se agregaron permisos especificos nuevos para `service_jobs`
  - no se implemento captura de motivo de archivo ni vistas/reportes avanzados de archivados
  - no se modificaron reglas de negocio, calculos, stock, documentos, caja, cuenta corriente, trabajos/servicios ni persistencia
- Migraciones nuevas:
  - `supabase/migrations/20260508143000_duplicate_documents.sql`
  - `supabase/migrations/20260508200000_company_price_rounding_settings.sql`
  - `supabase/migrations/20260508150000_product_combos.sql`
  - `supabase/migrations/20260508160000_remote.sql`
  - `supabase/migrations/20260508170000_product_combos_rpc.sql`
  - `supabase/migrations/20260508190000_cash_expenses_ui_support.sql`
  - `supabase/migrations/20260511120000_service_jobs_base.sql`
  - `supabase/migrations/20260511160000_service_remito_links.sql`
  - `supabase/migrations/20260511170000_customer_account_debit_generation_fix.sql`
  - `supabase/migrations/20260511173000_restore_issue_document_with_account_debit.sql`
  - `supabase/migrations/20260512023000_limit_document_debit_to_account_terms.sql`
  - sin migracion nueva para QA integral y hardening operativo
  - sin migracion nueva para QA visual y consistencia de UI
  - sin migracion nueva para control operativo de trabajos/servicios y limpieza visual de Listas de precios
  - sin migracion nueva para estado de cuenta operativo v1
  - sin migracion nueva para la consistencia de fechas/link de cuenta corriente
- Cobertura QA agregada para duplicado:
  - `src/features/documents/lib/duplicate.test.ts` cubre reglas de payload, fecha actual, bloqueo de devoluciones, trazabilidad y copia de lineas/snapshots sin reutilizar ids
  - `src/features/documents/components/DocumentsDataTable.test.tsx` cubre accion visible para `PRESUPUESTO`/`REMITO`, oculta para `REMITO_DEVOLUCION` y deshabilitada sin permiso de creacion
  - `src/features/db/criticalDb.test.ts` incluye casos de RPC real para duplicado de presupuesto/remito y bloqueo de devoluciones cuando se ejecuta con `DATABASE_URL` o variables `PG*` (`PGPASSWORD`, `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`)
- Cobertura QA agregada para redondeo:
  - `src/features/pricing/rounding.test.ts` cubre redondeo desactivado, incrementos 100/500/1000, decimales, cero, null/undefined, negativos e incrementos invalidos
  - `src/features/documents/hooks/useDocumentsMutations.test.tsx` cubre que una linea nueva use el precio redondeado como `unit_price`, mantenga `base_cost_snapshot` y respete override manual
  - `src/features/price-lists/components/PriceListProductsTable.test.tsx` cubre precio operativo redondeado, precio original cuando esta desactivado y no mutacion del valor persistido
  - `src/features/items/components/ItemsDataTable.test.tsx` cubre el mismo criterio visual en productos y no mutacion de metadata operativa
- Cobertura QA agregada para combos:
  - `src/features/combos/lib/buildComboLines.test.ts` cubre expansion de combo, multiplicador, combo vacio sin linea ficticia y validacion de entradas invalidas
  - `src/features/combos/lib/comboForm.test.ts` cubre la sincronizacion estable del formulario
  - `src/features/documents/components/DocumentsEditorDialog.test.tsx` cubre el render del editor con la nueva API de combos
  - `src/features/documents/hooks/useDocumentsMutations.test.tsx` ahora mockea Supabase y valida la mutacion sin depender de env real
  - `src/pages/Combos.test.tsx` cubre refresco visual inmediato del combo seleccionado e invalidacion de queries al guardar
  - `src/features/documents/lib/mergeComboDocumentLines.test.ts` cubre consolidacion de lineas repetidas por `item_id`, multiplicador efectivo y preservacion de precio manual
- Cobertura QA agregada para gastos de caja:
  - `src/features/cash/utils.test.ts` cubre validacion de monto/categoria/descripcion, suma de gastos activos, exclusion de anulados y efecto de gastos efectivo/no efectivo sobre el efectivo esperado
- Cobertura QA agregada para totales de caja:
  - `src/features/cash/lib/cashTotals.test.ts` cubre exclusion de ventas/gastos anulados, gasto efectivo contra efectivo neto, gasto no efectivo fuera de caja fisica, cuenta corriente separada, agrupacion por dia, sumatoria del periodo y rangos dia/semana/mes/personalizado
- Cobertura QA agregada para estado de cuenta:
  - `src/features/customer-account/lib/accountStatement.test.ts` cubre debito pendiente, debito vencido, credito como pago, saldo, filtro por fechas, exclusion de ocasional, referencia de remito, factura externa en filas y empty state
  - `src/lib/formatters.test.ts` cubre que `2026-05-09` se muestre como `09/05/2026` sin corrimiento de dia
  - `src/features/customer-account/lib/routes.test.ts` cubre el link filtrado `/customer-account?customerId=<id>` y la lectura de `customerId`/`customer_id` desde query params
- Cobertura QA agregada para trabajos/servicios:
  - `src/features/service-jobs/lib/serviceJobForm.test.ts` cubre payload valido de trabajo, bloqueo de titulo vacio, servicio con tecnicos, deduplicacion de tecnicos y normalizacion de estado/prioridad
  - `src/features/service-jobs/lib/serviceRemitos.test.ts` cubre payload de remito BORRADOR desde servicio, bloqueo de tipos no permitidos, bloqueo cross-company, resumen de remitos y advertencias de tecnico
  - `src/features/service-jobs/lib/operationalSummary.test.ts` cubre conteos por estado, servicios pendientes/realizados y suma de costo estimado desde remitos asociados
  - `src/App.routes.smoke.test.tsx` cubre que `/service-jobs` monte sin romper
- Cobertura QA agregada para Listas de precios:
  - `src/features/price-lists/lib/consultation.test.ts` cubre labels visuales de la consulta rapida
  - `src/features/price-lists/lib/consultation.test.ts` cubre que `?itemId=` seleccione la lista que contiene el producto destacado antes de mostrar el fallback
  - `src/pages/PriceLists.test.tsx` cubre que la pestania `Listas` mantenga `Listas configuradas`, quite la tabla gigante y conserve `Ver lista`, `Recalcular` y la navegacion con `?itemId=`
- Validacion manual recomendada en staging:
  - duplicar un presupuesto con varias lineas y confirmar borrador sin numero, fecha actual, lineas/precios copiados y trazabilidad
  - duplicar un remito emitido con tecnico y confirmar borrador con tecnico/lineas, sin factura externa y sin movimientos de stock
  - confirmar que `REMITO_DEVOLUCION` no muestra accion de duplicado
  - activar redondeo a $500 en Configuracion, agregar un producto con precio sugerido decimal a un presupuesto/remito y confirmar que `Sug`, `Precio unitario` y total inicial usan el valor redondeado
  - revisar Listas de precios y Productos para confirmar que muestran el precio operativo redondeado con referencia al precio original
  - editar manualmente el precio unitario y guardar/reabrir el borrador para confirmar que no se recalcula automaticamente

### Validaciones usadas para estos cambios

```sh
npm run db:push:staging
npm run typecheck
npm run lint
npm run test -- --run src/features/pricing/rounding.test.ts src/features/documents/hooks/useDocumentsMutations.test.tsx
npm run test -- --run src/features/price-lists/components/PriceListProductsTable.test.tsx src/features/items/components/ItemsDataTable.test.tsx
npm run test -- --run src/features/documents/lib/duplicate.test.ts src/features/documents/components/DocumentsDataTable.test.tsx
npm run test
npm run build
```

Validaciones de esta iteracion:

- `npm run typecheck`
- `npm run test -- --run src/features/price-lists/lib/consultation.test.ts src/features/customer-account/lib/routes.test.ts src/features/combos/lib/buildComboLines.test.ts`
- `npm run lint`
- `npm run test`
- `npm run build`
- sin migraciones nuevas; no se ejecuto `npm run db:push:staging` para esta fase
- `npm run test -- --run src/features/service-jobs/lib/serviceJobForm.test.ts src/App.routes.smoke.test.tsx`
- `npm run test -- --run src/features/service-jobs/lib/serviceRemitos.test.ts`
- QA funcional contra staging con usuario real: login, carga directa de `/service-jobs`, alta/edicion de trabajo, alta/edicion de servicio, tecnico asignado, bloqueo de tecnico duplicado, filtros por estado/titulo/cliente/tecnico e integridad de tablas criticas
- QA manual final: rutas principales, hard reload y query params sobre staging actualizado; `/technicians` corregido y revalidado sin error boundary; consultas sin escrituras nuevas en tablas criticas
- QA visual: revision por codigo de tablas, badges, acciones, filtros, cards y empty states en pantallas principales; correcciones aplicadas sobre componentes compartidos sin cambios funcionales
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- sin migraciones nuevas; no se ejecuto `npm run db:push:staging` para esta fase visual
- `npm run db:push:staging`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run db:push:staging`
- QA DB directa de cuenta corriente pendiente: el entorno local no tiene password DB usable; `criticalDb.test.ts` queda preparado y se saltea sin `PGPASSWORD`.
- `npm run db:push:staging`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- QA transaccional real posterior requerida para confirmar que remitos identificados no cuenta corriente ya no generan `DEBIT`.
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- sin migraciones nuevas para exponer Tecnicos en navegacion

Notas:

- `npm run test` deja `src/features/db/criticalDb.test.ts` en `skipped` si no hay `PGPASSWORD` configurado.
- QA DB crítica autenticada contra staging: 40/40 casos aprobados con rollback transaccional. Los escenarios remotos lentos usan un timeout explícito de 15 segundos y los rechazos esperados recuperan la transacción mediante `SAVEPOINT`.
- La migracion de trabajos/servicios se debe aplicar en staging con `npm run db:push:staging` antes de probar `/service-jobs`.
- En staging no habia tecnicos cargados al iniciar el QA manual; se creo un tecnico QA en la entidad `technicians` existente para validar la asignacion desde trabajos/servicios.
- La migracion de combos ya se aplico en staging con `npm run db:push:staging --include-all` por una diferencia de historial remoto.
- La migracion de gastos de caja se aplico en staging con `npm run db:push:staging`.
- El guardado de combos ya no persiste parcialidades cabecera/lineas: la escritura pasa por una RPC transaccional en Supabase.
- Fix de estabilidad validado en preview: seleccionar un combo existente ya no muestra una linea vacia por hidratar antes de recibir `product_combo_lines`.
- Limitacion restante de combos: no hay borrado fisico, importacion masiva ni combos dentro de combos.
- Limitacion restante de listas rapidas: la lista favorita se guarda localmente por navegador/usuario/empresa; no se sincroniza entre dispositivos.
- Limitacion restante de gastos: no hay adjuntos reales, OCR, aprobaciones, reportes mensuales ni edicion de gastos cerrados; si un gasto activo se cargo mal, se anula y se registra nuevamente.
- Limitacion restante de totales: no hay exportacion Excel, graficos avanzados ni detalle transaccional expandible por dia. El reporte pagina exhaustivamente ventas, gastos y ajustes del rango, valida el conteo remoto y falla de forma explicita si no puede garantizar un resultado completo.
- Limitacion restante de estado de cuenta: no hay imputacion avanzada de pagos por factura/remito, exportacion Excel, intereses, alertas ni conciliacion bancaria; el estado por debito se calcula como estimacion del saldo del cliente.
- La migracion `20260511160000_service_remito_links.sql` se debe aplicar en staging con `npm run db:push:staging` antes de probar remitos asociados a servicios.
- Limitacion restante de trabajos/servicios: hay vinculo operativo con remitos actuales, pero no hay materiales manuales dentro del servicio, facturacion desde trabajo, rentabilidad avanzada, reportes, calendario, adjuntos ni checklist tecnico; el guardado de tecnicos de un servicio reemplaza asignaciones en dos pasos desde la UI.
- Limitacion restante de tecnicos: el modulo queda expuesto para gestion operativa basica; no incluye reportes, costos por tecnico, dashboard ni permisos especificos nuevos.
- Limitacion restante de QA visual: quedan modales grandes y vistas de impresion para una pasada visual especifica con screenshots comparativos antes de promover a `main`.
- Recomendacion QA integral: staging puede avanzar a QA manual final sobre datos reales antes de promover a `main`; no se detectaron cambios de esquema pendientes en esta fase.

## Deploy

La aplicacion web se despliega mediante la integracion de Vercel configurada para el repositorio. Las migraciones se publican por separado con los scripts `db:push:staging` y `db:push:prod`.

## Security hardening (PR1)

### Required environment variables
Create a local `.env` file (not committed) based on `.env.example`:

```sh
cp .env.example .env
```

Then complete:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

> `.env` is ignored by git and must not be committed. Use `.env.example` as template.

If either variable is missing, the app renders a clear **"Configurar .env"** screen instead of failing with a blank page.

### Roles and admin promotion
New users are now created with role `user` by default.

To promote a specific user to admin, run this SQL in Supabase SQL Editor:

```sql
insert into public.user_roles (user_id, role)
values ('<USER_UUID>', 'admin')
on conflict (user_id, role) do nothing;
```

To revoke admin:

```sql
delete from public.user_roles
where user_id = '<USER_UUID>'
  and role = 'admin';
```

### RLS model used
For operational tables (`items`, `item_aliases`, `stock_movements`, `suppliers`, `price_lists`, `price_list_versions`, `price_list_lines`, `customers`, `quotes`, `quote_lines`):

- **Read**: any authenticated user (keeps current UX and cross-module listings).
- **Write**: only record owner (`created_by = auth.uid()`) or `admin`.

This preserves current functionality for each creator while removing previous permissive `USING (true)` write access.

## Importación de listas (CSV + XLSX)

Flujo rápido:

1. Ir a **Importaciones** y elegir la lista de precios.
2. Subir archivo `.csv` o `.xlsx` (se usa la primera hoja para XLSX).
3. Mapear columnas obligatorias: **Descripción** y **Precio**. **Código proveedor** es opcional.
4. Revisar preview: se muestran solo filas válidas (filas vacías se descartan automáticamente).
5. Confirmar importación.

Notas:

- El parser tolera precios con `,` o `.` como separador decimal, símbolos de moneda y espacios.
- Si el archivo no se puede leer, se informa un error claro en pantalla y en consola.

## Importación asistida con IA para PDFs difíciles

Se agregó una capa opcional para PDFs de proveedores con muchas imágenes o texto poco legible:

- El flujo sigue intentando primero con `pdfjs` y OCR local.
- Si el resultado es flojo, prueba automáticamente motores externos vía Edge Functions de Supabase.
- La prioridad gratis actual es `Gemini`.
- `Mistral OCR` queda como motor opcional, no requerido.
- Si los motores externos no están configurados o fallan, el sistema vuelve al parser actual sin cortar la importación.

### Configuración

1. Configuracion minima gratis en Supabase:

```sh
supabase secrets set GEMINI_API_KEY=tu_api_key
supabase secrets set GEMINI_MODEL=gemini-2.5-flash
```

2. Desplegar la función:

```sh
supabase functions deploy supplier-pdf-ai-extract
```

3. Verificar que la sesión del usuario autenticado pueda invocar Edge Functions normalmente.

### Qué devuelve Gemini

La función intenta devolver una estructura limpia con:

- `supplier_code`
- `description`
- `price`
- `currency`

Luego el frontend reutiliza el mismo modal de mapeo PDF y el pipeline de importación, ahora con una revisión final antes de confirmar el alta del listado.

## Asistente IA para Presupuestos de Servicios

El modulo de Presupuestos de Servicios tiene un asistente opcional para armar propuestas iniciales desde una descripcion libre del trabajo. La IA solo sugiere: lineas, materiales posibles, mano de obra estimada, rango de precio, notas, advertencias y datos faltantes. El resultado final siempre se revisa y se guarda como un Presupuesto de Servicio normal en estado `DRAFT`.

La implementacion inicial usa Gemini desde una Edge Function de Supabase (`service-quote-ai-assistant`). El frontend no llama al proveedor directamente ni recibe credenciales.

El provider intenta enriquecer la propuesta con Google Search grounding de Gemini de forma automatica e interna. Cuando la moneda preferida es USD, tambien intenta incorporar una cotizacion BNA minima como referencia de conversion. No agrega botones, checkboxes ni decisiones de fuente en la UI. Si grounding o BNA fallan, la funcion conserva el flujo normal con historico interno, configuracion de empresa y criterio IA.

### Configuracion

1. Configurar secrets en Supabase staging:

```sh
supabase secrets set GEMINI_API_KEY=tu_api_key
supabase secrets set AI_SERVICE_QUOTE_MODEL=gemini-2.5-flash-lite
supabase secrets set AI_PROVIDER=gemini
```

`AI_SERVICE_QUOTE_MODEL` y `AI_PROVIDER` son opcionales. Si no se configuran, la funcion usa el modelo economico definido por defecto y el provider `gemini`. `AI_SERVICE_QUOTE_USE_GROUNDING=false` permite desactivar el intento automatico de referencias externas ante limites operativos, sin cambiar la UX.

2. Desplegar la funcion:

```sh
supabase functions deploy service-quote-ai-assistant
```

3. Aplicar migraciones en staging:

```sh
npm run db:push:staging
```

### Seguridad y trazabilidad

- `GEMINI_API_KEY` se lee solo desde secrets/env de Supabase.
- Si falta la key, la UI muestra: `El asistente IA no esta configurado todavia.`
- Si Gemini falla o devuelve JSON invalido, el formulario manual sigue funcionando.
- Las sugerencias validadas se guardan en `service_document_ai_suggestions` sin secrets.
- `output_snapshot` guarda `pricingSources`, `confidenceReasons`, resumen/limitaciones de referencias externas, metadata minima de grounding cuando existe y snapshot BNA minimo si fue usado; no guarda HTML ni paginas completas.
- Cuando el usuario guarda el presupuesto armado con IA, la sugerencia queda marcada como aceptada y asociada al `service_document_id`.
- La tabla `service_quote_ai_settings` deja preparado un modelo de configuracion por empresa para tarifas, margenes y terminos comerciales.

### Limites

- Las sugerencias son orientativas y deben revisarse antes de enviar.
- La IA no crea remitos, no emite documentos, no toca caja, no toca stock y no toca cuenta corriente.
- La IA no comparte ni envia presupuestos automaticamente.
- El flujo manual de presupuestos sigue siendo el camino principal y no depende de la disponibilidad de Gemini.
- Google documenta soporte de Search grounding y structured outputs para `gemini-2.5-flash-lite`. El free tier de grounding puede tener limites diarios compartidos y el paid tier puede facturar solicitudes grounded; por eso la funcion mantiene fallback automatico.

## Migración definitiva (Supabase CLI, sin dashboard)

Se agregó la migración:

- `supabase/migrations/20260226090000_fix_schema_cache_price_list_items_and_supplier_nullable.sql`

Incluye:

- `suppliers.whatsapp` (nullable) + backfill opcional desde `phone`/`telefono` si existen.
- `price_lists.supplier_id` nullable + FK con `ON DELETE SET NULL`.
- creación idempotente de `public.price_list_items` + índices + RLS owner/admin.
- `NOTIFY pgrst, 'reload schema';` al final para recargar schema cache de PostgREST.

### Aplicar desde el proyecto

```sh
supabase db push
```

> Alternativa (según versión/flujo de tu CLI):

```sh
supabase migration up
```

### Verificación rápida por SQL

```sql
-- 1) columna suppliers.whatsapp existe
select column_name, is_nullable, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'suppliers'
  and column_name = 'whatsapp';

-- 2) tabla public.price_list_items existe
select to_regclass('public.price_list_items') as price_list_items_table;

-- 3) price_lists.supplier_id ya no es NOT NULL
select column_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'price_lists'
  and column_name = 'supplier_id';
```

## Facturacion - base interna

La primera fase de Facturacion agrega una base fiscal interna, sin autorizacion fiscal real:

- Migracion: `supabase/migrations/20260602120000_billing_base_model.sql`.
- Tablas nuevas: `billing_settings`, `billing_points_of_sale`, `billing_documents`, `billing_document_lines` y `billing_events`.
- Permisos nuevos: `billing.view`, `billing.create`, `billing.authorize`, `billing.credit_note`, `billing.print` y `billing.settings`.
- Roles: `admin` recibe todos los permisos `billing.*`; `operador` recibe `billing.view`, `billing.create` y `billing.print`; `consulta` recibe solo `billing.view`.
- RLS sigue el patron multitenant por `company_id` con `is_company_member` y `has_company_permission`.
- Feature flag: la UI y la RPC usan `billing_settings.is_enabled`; no existe un sistema general de feature flags en esta base.
- Flujo implementado: desde una venta de Caja (`cash_sales`) asociada a un `REMITO EMITIDO`, se crea un `billing_documents` en `DRAFT` para `FACTURA_B` a `Consumidor Final`.
- La RPC `create_billing_draft_from_cash_sale(cashSaleId, invoiceType)` valida empresa, permiso, venta no anulada, `receipt_kind = REMITO`, remito emitido, misma empresa, lineas existentes y ausencia de documento fiscal activo previo.
- Las lineas se copian desde `document_lines` a `billing_document_lines`; los totales se congelan desde el remito comercial.
- Fallback fiscal: en esta fase no se calcula ni distribuye IVA fiscal autoritativo; se preservan `tax_total`/`tax_pct` comerciales cuando existen, sin convertirlos en autorizacion fiscal.
- La creacion del borrador no llama a Afip SDK, no solicita CAE, no asigna punto de venta fiscal, no asigna numero fiscal y no guarda request/response de proveedor.
- La creacion del borrador no modifica stock, caja, cierre de caja ni cuenta corriente.
- UI: `/billing` lista borradores internos y muestra detalle con origen, receptor, lineas, totales y aviso de que el comprobante no tiene CAE.
- Caja muestra acciones separadas para `Crear borrador Factura B` y `Crear borrador Factura A` solo si Facturacion esta habilitada, el usuario tiene `billing.create`, la venta tiene remito y no existe borrador activo previo.

### Factura A borrador gated

- Migracion: `supabase/migrations/20260605120000_billing_invoice_a_draft_gated.sql`.
- `billing_documents.invoice_type` admite `FACTURA_A` solo para `document_kind = INVOICE`.
- Factura A queda limitada a estados `DRAFT`, `BLOCKED` o `CANCELLED_INTERNAL`; la base bloquea CAE, numero fiscal, fecha de comprobante y autorizacion para `FACTURA_A`.
- La RPC `create_billing_draft_from_cash_sale(cashSaleId, "FACTURA_A")` crea solo borrador interno desde venta/remito existente.
- Requiere cliente real no ocasional, CUIT valido, razon social oficial, `VALIDATED_AUTO`, `legal_name_source = OFFICIAL`, `tax_condition_source = OFFICIAL_DERIVED`, `tax_condition = RESPONSABLE_INSCRIPTO` y `taxpayer_status = ACTIVO`.
- El receptor fiscal se congela en `receiver_fiscal_snapshot` desde `customer_fiscal_profiles`; no depende de datos manuales editables ni de mocks.
- La UI permite ver detalle e imprimir A4 como borrador con leyenda `Factura A en preparacion. No emite comprobantes.`
- No hay boton de autorizacion para Factura A. La edge function de autorizacion tambien rechaza `FACTURA_A` con bloqueo explicito.
- No implementa Nota de Credito A, no solicita CAE, no asigna punto de venta fiscal, no asigna numero fiscal y no llama a Afip SDK.
- La creacion del borrador A no modifica stock, caja, cierre de caja ni cuenta corriente.
- Factura B y Nota de Credito B siguen sin cambios.

## Facturacion AFIPSDK dev - CUIT emisor

La autorizacion fiscal de Factura B en homologacion AFIPSDK usa datos no secretos configurados por empresa:

- El CUIT emisor se carga desde **Facturacion > Configuracion fiscal** y se guarda normalizado, solo numeros, en `billing_settings.issuer_tax_id`.
- El CUIT puede ingresarse con o sin guiones; la UI valida que queden 11 digitos antes de guardar.
- El ambiente disponible en esta fase es `dev`/homologacion. No se habilita `prod` desde la UI.
- Los puntos de venta fiscales se gestionan en la misma seccion usando `billing_points_of_sale`.
- Los tokens, certificados y credenciales de Afip SDK siguen configurandose como Supabase Secrets. No se guardan en la base ni se exponen al frontend.
- No hay CUIT hardcodeado en la aplicacion: el usuario debe cargarlo manualmente.
- La autorizacion de Factura B Consumidor Final sigue limitada a ambiente dev. No incluye Factura A, Nota de Credito A, Nota de Debito ni PDF de Afip SDK.

## Facturacion AFIPSDK dev - Nota de Credito B

La Nota de Credito B de homologacion permite anular fiscalmente una Factura B autorizada sin mezclarla con devoluciones fisicas:

- Migracion: `supabase/migrations/20260603170000_billing_credit_note_b_dev.sql`.
- Nace solo desde una `FACTURA_B` con `document_kind = INVOICE`, `fiscal_status = AUTHORIZED`, numero fiscal y CAE.
- La RPC `create_billing_credit_note_b_from_invoice(billingDocumentId)` crea un `billing_documents` en `DRAFT` con `document_kind = CREDIT_NOTE`, `invoice_type = NOTA_CREDITO_B`, `source_type = CREDIT_NOTE_FROM_INVOICE` y `related_billing_document_id` apuntando a la factura original.
- El MVP es total: copia receptor, lineas, remito interno de referencia y totales completos desde la factura original. No implementa notas parciales.
- La base bloquea mas de una Nota de Credito B activa/autorizada para la misma factura mediante indice unico parcial.
- La autorizacion reutiliza `billing-authorize-document` en ambiente `dev`, usa Afip SDK/WSFE con tipo de comprobante Nota de Credito B y envia `CbtesAsoc` con tipo, punto de venta, numero y fecha de la Factura B asociada.
- La creacion y autorizacion no modifican stock, caja, remito original, lineas del remito ni cuenta corriente.
- La Nota de Credito B fiscal no dispara `REMITO_DEVOLUCION`; una devolucion fisica sigue siendo otro flujo.
- La impresion usa la vista HTML interna y `window.print()`, muestra la factura asociada, CAE, vencimiento y QR fiscal. No usa el endpoint PDF de Afip SDK.
- Pendiente: notas parciales, Nota de Credito A, Factura A, Nota de Debito y produccion.

## Facturacion - hardening preproduccion

La pantalla operativa `/billing` queda separada de la configuracion fiscal:

- `/billing` muestra solo comprobantes, filtros, estados, acciones de autorizacion, impresion y Nota de Credito B total.
- La configuracion de CUIT, provider, ambiente, puntos de venta y diagnostico vive en `Configuracion > Facturacion fiscal`.
- El diagnostico fiscal expone solo estados booleanos/presencia de secrets. No devuelve tokens, certificados ni valores sensibles.
- Los comprobantes `AUTHORIZING` recientes quedan bloqueados para evitar doble emision; los trabados por mas de 10 minutos pueden liberarse con una RPC controlada si no tienen CAE ni numero fiscal.
- Los errores de Afip SDK se normalizan para mostrar mensajes accionables sin Bearer, tokens, certificados, private keys ni payloads largos.
- El ambiente habilitado sigue siendo `dev`/homologacion. Produccion, Factura A, Nota de Credito A, Nota de Debito y notas parciales quedan fuera de esta fase.

## Database migrations

### Órdenes de compra (2026-07-14)

- Los pedidos armados desde catálogos de proveedores viven en el módulo independiente `/purchase-orders`, sin reemplazar ni eliminar la lista fuente.
- La pantalla permite consultar y filtrar órdenes, editar cantidades y notas de borradores, marcarlos como enviados o cancelar borradores y órdenes enviadas.
- Solo los borradores se eliminan. Las órdenes enviadas se conservan o cancelan para mantener trazabilidad.
- La migración `20260714100000_supplier_purchase_orders_workflow.sql` extiende las tablas seguras existentes con RPC atómicas, empresa activa y permiso `suppliers.edit`; no duplica el modelo de datos.
- Estas operaciones no generan stock, caja, cuenta corriente ni facturación. La migración se aplica únicamente en staging y no modifica producción.

Migrations are stored in:

`supabase/migrations`

### Operational UX update (2026-06-25)

- Customer account due days are configured per customer through `customers.account_due_days`.
- Product creation now offers direct follow-up actions for base cost and initial stock.
- Documents support a global manual discount and direct WhatsApp sharing.
- Main operational tables use the shared shadcn table and pagination patterns where applicable.
- Product setup guides cost and stock entry; product, base-price, service, customer and document workflows include the latest table and navigation fixes.

### Item onboarding reliability (2026-07-13)

- Item creation now invalidates the item, pricing and stock catalogs so the new record is immediately available in both setup steps.
- The base-cost setup deep link takes precedence over saved UI state, and cost plus history are persisted atomically by `update_item_base_cost`.
- Stock movement search only displays matching results, reads stock from the complete company catalog and scopes drafts by user and company.
- Migration: `20260713120000_atomic_item_base_cost_update.sql`. Apply and validate it in staging only before QA.

Step 1 - deploy to staging:

```sh
npm run db:push:staging
```

Step 2 - verify staging.

Step 3 - deploy to production:

```sh
npm run db:push:prod
```

Production migration history note:

- On 2026-05-21, remote-only migration version `20260514213000` was marked as `reverted` in production with `npx supabase migration repair --status reverted 20260514213000`.
- This version did not exist in local migrations or git and only blocked production pushes.
- Do not recreate `20260514213000` as a new migration; future schema changes should use a new timestamped migration file.

## Shell responsive y navegación operativa

- El shell usa gutters de 16 px en mobile y recupera progresivamente el espaciado de escritorio.
- La navegación principal conserva todas las rutas y permisos, pero en pantallas angostas se presenta como una única franja horizontal desplazable en lugar de crecer en múltiples filas.
- Las tabs de `PageHeader` pueden desplazarse horizontalmente y las acciones del encabezado ocupan el ancho disponible en mobile.
- No se modificaron reglas de negocio, permisos, rutas ni datos.

## Jerarquía visual de Totales de Caja

- `Totales` presenta el total vendido como métrica principal y ordena efectivo, gastos, cuenta corriente y devoluciones como métricas secundarias.
- El desglose diario reutiliza el contenedor operativo y el formato monetario compartidos por el sistema visual.
- Los filtros mantienen los mismos períodos y las consultas continúan aisladas por empresa; no cambiaron cálculos ni fuentes de datos.

## Experiencia operativa de documentos de servicio

- La lista de presupuestos reutiliza el contenedor visual operativo, muestra estados legibles en temas claro y oscuro y reduce el ancho reservado a acciones.
- Vista previa permanece como acción principal; edición, estados, duplicado, compartir, PDF e impresión se agrupan en un selector con rótulos claros.
- Los cambios de estado, duplicados y la incorporación de líneas sugeridas por IA usan confirmaciones internas con contexto, sin diálogos nativos del navegador.
- No se modificaron reglas de negocio, permisos, consultas, impresión ni aislamiento por empresa.

## Combos: workbench operativo

- La pantalla usa una disposición maestro-detalle: listado y búsqueda a la izquierda, edición del combo a la derecha.
- La selección, el estado activo y las acciones son controles independientes y accesibles.
- Los cambios sin guardar se protegen con una confirmación dentro de la aplicación, tanto al cambiar de combo como al limpiar el formulario.
- La tabla de productos conserva su legibilidad en pantallas angostas mediante desplazamiento horizontal contenido.
- No requiere migraciones ni modifica la persistencia existente.

## Facturación: workbench operativo

- La cabecera identifica de forma visible el ambiente de homologación, los comprobantes habilitados y el bloqueo de producción.
- Los indicadores separan autorizados, pendientes, rechazados, notas de crédito y borradores de Factura A con estados visuales consistentes.
- El listado incorpora búsqueda, filtros combinables, errores recuperables y una selección adaptada a móviles sin duplicar acciones fiscales críticas.
- El detalle concentra la lectura y las acciones del comprobante seleccionado; no se modificaron reglas fiscales, permisos, consultas ni aislamiento por empresa.
- No requiere migraciones ni cambios de configuración.

## Rediseño visual: piloto operativo

- Inicio implementa el primer corte definitivo del nuevo lenguaje visual: shell liviano con rail lateral, selector de módulos accesible, superficies translúcidas compatibles con tema claro/oscuro y un tablero responsive basado exclusivamente en datos reales de la empresa activa.
- El panel analítico alterna Ventas, Stock y Rentabilidad con métricas y series verificables. Stock se oculta por completo cuando falta `stock.view`; la migración `20260717120000_dashboard_stock_permission_hardening.sql` refuerza ambos RPC del dashboard y expone la capacidad efectiva sin relajar RLS.
- Atención operativa, destacados y estados de carga/error/vacío usan componentes focalizados; se eliminaron el gráfico mensual duplicado y la lógica monolítica anterior de `Index`.
- El buscador de módulos soporta `Ctrl/Cmd + K`, resultados vacíos, retorno de foco y navegación móvil sin interceptar atajos dentro de campos editables.
- El alcance de esta rama es Inicio y la fundación compartida del shell. La expansión al resto de las secciones, formularios, tablas y modales continuará por módulos en PR separados para mantener cambios revisables.

- Se definió el North Star "mesa de operaciones digital moderna": precisa, enérgica, tecnológica, expresiva y operativa, en `docs/visual-redesign-north-star.md`.
- La paleta separa identidad core, estados funcionales y acentos por dominio. Navegación, encabezados, selección, KPI prioritarios y gráficos reciben color dirigido; tablas y formularios base se mantienen deliberadamente calmos.
- La fundación de navegación mantiene Dashboard como acceso directo y reúne el resto de los módulos por dominio en un selector adaptable, con firma cromática consistente y sin carrusel horizontal.
- Dashboard incorpora composición asimétrica, KPI principal destacado y gráficos con patrones/trazos redundantes; Documentos usa firma violet sin mezclar tipo, estado y acción; Caja usa firma emerald sin convertir ingresos o egresos en estados semánticos.
- Se limitaron los gradientes a las familias core, tech y domain wash; se eliminaron hover con desplazamiento, blur y elevación global de las superficies operativas.
- No se modificaron reglas de negocio, consultas, permisos, multitenancy ni persistencia. No requiere migraciones.
- La pantalla pública de autenticación fue revisada en 1920 px, 1366 px, móvil y zoom 125 %, sin overflow ni errores visuales; las rutas protegidas requieren una sesión QA de staging y su revisión visual autenticada sigue pendiente.
- Los hallazgos altos de la revisión del piloto se corrigieron en código: acciones de fila, truncado de importes, overflow, targets táctiles, navegación, contraste semántico, codificación accesible de gráficos y separación entre dominio/estado/acción.
- La dirección de analítica aprobada combina flujos proporcionales y superficies topográficas con profundidad 2.5D sutil, leyendas y magnitudes verificables; el dashboard podrá alternar Stock, Ventas, Rentabilidad y Cuentas corrientes sin usar formas meramente decorativas.
- La base del piloto deriva los grupos de navegación desde una única configuración, comparte tonos entre indicadores y elimina exports y estilos sin consumidores comprobados.
- La expansión se hará en PR separados: migración compatible a tema claro/oscuro, inventario, comercial, compras, servicios y administración. La poda transversal seguirá por módulos y con tests, sin borrar automáticamente los falsos positivos de las herramientas estáticas.

## Espacios de trabajo con pestañas

- Stock unifica Resumen, Stock y Movimientos bajo una misma cabecera de espacio de trabajo, con filtros, métricas, tablas, estados y paginación canónicos.
- Precios base y Listas comparten la misma navegación y densidad operativa; sus productos usan celdas primarias, importes, badges y acciones de fila del sistema visual.
- Cuenta corriente adopta el mismo contenedor, métricas y tabla compacta sin modificar saldos, consultas ni permisos.
- El detalle de catálogos de proveedores reutiliza pestañas, filtros, tabla, estados y acciones canónicas, incluida la comparación de ofertas.
- No se modificaron reglas de negocio, query keys, aislamiento por `company_id`, persistencia ni base de datos. No requiere migraciones.

## Superficies analíticas canónicas

- Dashboard, Caja, Totales, el resumen analítico de Stock y las métricas de Rendiciones comparten la jerarquía canónica de encabezado, controles, métricas, visualización y atención operativa.
- Las métricas primarias y secundarias reutilizan `MetricGrid` y `MetricCard`; estados, conteos, importes y tablas usan sus primitives semánticas sin variantes locales ni imports deprecated.
- Los gráficos conservan la composición adecuada para cada dominio, con color semántico accesible y contexto textual, sin forzar superficies analíticas idénticas.
- Se preservaron permisos, query keys, aislamiento por `company_id`, cálculos y comportamiento funcional. No requiere migraciones ni cambios de base de datos.

## Administración visual canónica

- Usuarios, empresas, roles, permisos y configuración comparten encabezados, métricas, filtros, tablas, celdas primarias, estados y acciones sensibles del sistema visual canónico.
- La administración de empresa conserva su contexto y permisos; las acciones globales de usuarios y empresas continúan restringidas a Superadmin.
- Los diálogos de detalle y acceso muestran membresías, roles y permisos con jerarquía semántica, sin imports visuales deprecated ni variantes locales.
- No se modificaron consultas, mutations, query keys, RLS, aislamiento por `company_id`, reglas de negocio ni Facturación. No requiere migraciones ni cambios de base de datos.

## Overlays, formularios y feedback canónicos

- `EntityDialog` usa ancho de formulario, cabecera y acciones fijas, con scroll interno únicamente en el cuerpo para sostener el contexto en pantallas pequeñas y zoom alto.
- Diálogos y confirmaciones comparten límites de viewport, cierre accesible, foco contenido y retorno al control que los abrió; inputs, selects y textareas exponen el estado inválido con borde y foco semánticos.
- Loading, vacío y error se distinguen mediante `DataState`; las tablas pueden ofrecer reintento sin reemplazar su superficie ni perder la jerarquía operativa.
- Los toasts mantienen visible y accesible su control de cierre. No se modificaron reglas de negocio, consultas, mutations, permisos, RLS, aislamiento por `company_id` ni Facturación.
- No requiere migraciones ni cambios de base de datos.

## Consolidación visual final

- Dashboard reserva ancho suficiente para las tres métricas laterales y usa la grilla canónica sin textos recortados.
- `MetricCard` mantiene igual altura y centra verticalmente título, valor, ayuda e icono; `MetricGrid` centraliza las variantes responsive y preserva un ancho legible para las grillas de tres columnas según el espacio real del contenedor.
- `FilterToolbar` alinea por la base buscadores, selects y controles etiquetados. El editor de documentos alinea `Opciones de documento` con el resto de sus campos.
- `DialogActionGrid` normaliza tamaño y alineación de las acciones en Documentos y Caja.
- Se retiraron los adapters visuales deprecated y las recetas CSS reemplazadas después de verificar cero consumidores; la gobernanza evita que reaparezcan.
- No se modificaron reglas de negocio, consultas, mutations, permisos, RLS, aislamiento por `company_id`, base de datos ni el alcance funcional de Facturación. No requiere migraciones.

## Normalización transversal de cards, badges y controles

- Dashboard evita comprimir las métricas junto al gráfico hasta disponer de ancho suficiente; su skeleton conserva la misma estructura responsive.
- Stock e Ítems reutilizan `MetricGrid`, `MetricCard`, `HealthBadge`, `CategoryBadge`, `StatusBadge` y `CountBadge` según la semántica real del dato, sin variantes visuales locales.
- Documentos alinea buscador, filtros y opciones del editor, y sus acciones usan una superficie de tamaños homogéneos.
- Cuenta corriente, cotizaciones, precios y catálogos distinguen estados, categorías e información contextual con las primitives canónicas correspondientes.
- No se modificaron reglas de negocio, consultas, query keys, permisos, RLS, aislamiento por `company_id`, base de datos ni Facturación. No requiere migraciones.

## Suite crítica de base de datos

- Los fixtures usan el modelo canónico de roles globales, el esquema vigente de clientes y membresías válidas por empresa.
- Los rechazos esperados se ejecutan con savepoints para no contaminar la transacción del caso de prueba.
- La cobertura de permisos de Rendiciones concede explícitamente cada acción ejercitada por el escenario.
- No requiere migraciones ni modifica datos persistentes: los casos transaccionales revierten sus fixtures.

## Aislamiento de cache y constitucion tecnica

- La identidad efectiva combina actor, usuario efectivo e instancia de impersonacion. Logout, cambio de usuario, inicio/fin de impersonacion y restauracion cancelan requests, vacian React Query y descartan respuestas tardias.
- El cambio normal de empresa elimina solamente el cache identificado con la empresa anterior y mantiene permisos vacios hasta validar el nuevo contexto.
- Los guardrails verifican cero ciclos con Madge, impiden ampliar imports directos de Supabase desde pages y exigen `companyId` en las query keys canonicas del alcance.
- Las reglas para codigo nuevo, capas, testing, dependencias, performance y eliminacion segura de codigo muerto estan en [`docs/stock-sur-technical-constitution.md`](docs/stock-sur-technical-constitution.md).
- Este cambio no incluye migraciones ni modificaciones de base de datos.

## Limites de datos y cache de tecnicos

- Las consultas de Tecnicos y Control de materiales usan factories canonicas con `companyId`, incluidos renglones y servicios derivados.
- Las mutations de tecnicos exigen empresa activa, acotan update/delete por `company_id` e invalidan solamente Tecnicos, Documentos y Trabajos de la empresa afectada.
- El cambio evita reutilizar datos derivados entre empresas y no modifica esquema, RLS ni reglas de negocio.

## Limites de datos de Caja y cuenta corriente

- `CashTotals` y `CustomerAccount` se limitan a componer estado y UI; sus consultas viven en hooks de feature.
- Las query keys canonicas conservan `companyId`, filtros y habilitacion condicionada a una empresa activa.
- El guardrail arquitectonico ya no necesita excepciones para imports directos de Supabase en estas paginas.
- No se modificaron reglas de negocio, resultados visuales, permisos, RLS ni esquema. No requiere migraciones.

## Cache optimista del catalogo de items

- La actualizacion masiva del tipo de demanda opera sobre la misma query key canonica que renderiza el catalogo: empresa, categoria y estado activos.
- El rollback restaura exclusivamente el snapshot que inicio la operacion, incluso si el usuario cambia de empresa o filtros mientras la mutation esta pendiente.
- La confirmacion invalida solo ese catalogo; no crea cache global de items ni refresca dominios de Stock que no fueron modificados.
- No requiere migraciones ni modifica reglas de negocio, RLS o datos fuera de la accion solicitada.

## Cache auxiliar de importaciones

- Las listas disponibles para importar usan una query key canonica segmentada por `companyId`.
- Al completar una importacion no se invalida la cache de listas de venta: la operacion crea una version y sus lineas, pero no modifica las opciones de listas consultadas.
- No requiere migraciones ni modifica reglas de negocio, RLS o datos fuera de la importacion confirmada.

## Formularios y validacion de identidad de empresas

- La creacion y la edicion de empresas comparten la misma normalizacion pura para nombre e identificador.
- Los identificadores se envian siempre en el formato canonico exigido por la base de datos: minusculas ASCII, numeros y guiones.
- La regresion unitaria cubre espacios, acentos y separadores; no se modifican permisos, RLS, reglas de negocio ni esquema.

## Accesos administrativos atomicos

- La membresia, el rol y las excepciones de permisos de un usuario se reemplazan mediante una unica RPC transaccional.
- La RPC deriva la membresia por usuario y empresa, exige Superadmin, valida empresa activa, rol administrable y permisos permitidos.
- El formulario bloquea el guardado hasta cargar el snapshot completo y ofrece reintento ante errores, evitando sobrescribir excepciones con estado incompleto.
- Migracion de staging: `20260725120000_atomic_user_company_access.sql`. No se aplico ni se modifico produccion.

## Higiene de contratos y codigo muerto

- Knip audita tanto el frontend como la funcion serverless de PDF; excluye contratos de tipos publicos y el archivo generado de Supabase, y documenta las herramientas ejecutadas por scripts.
- Se retiraron exports, constantes visuales y wrappers de Rendiciones sin consumidores comprobados, sin modificar los RPC ni los flujos activos.
- Se eliminaron dos artefactos `.diff` historicos versionados por error y seis contratos TypeScript sin referencias verificadas mediante busqueda global y Knip.
- El catalogo de componentes referencia la ubicacion canonica real de `RowActions`.
- No requiere migraciones ni cambios de datos.

## Higiene de dependencias

- Knip 6 queda como auditor canonico de dependencias, archivos y exports; su configuracion ya no mantiene excepciones redundantes para herramientas invocadas desde scripts.
- Se retiro Depcheck porque duplicaba esa auditoria y reportaba como defectos dependencias validas de PostCSS e imports `npm:` de Supabase Functions.
- Madge conserva la verificacion independiente de ciclos. No se modificaron dependencias de runtime, reglas de negocio, datos ni base de datos.

## Retiro de scripts historicos de catalogo

- Se retiraron los once scripts puntuales del 09/04/2026 usados por el PR #138 para normalizar y sincronizar el catalogo.
- Los cambios aplicados permanecen trazados por las migraciones y el historial Git; estos artefactos no tenian consumidores y no formaban parte de la operacion actual.
- Se elimino tambien la utilidad manual que permitia escribir directamente en `main`, en linea con el flujo vigente que prohibe tocar produccion desde tareas normales.
- No se ejecutaron scripts, no se modificaron datos ni esquema y no requiere migraciones.

## Retiro de helpers sin consumidores

- Se retiraron cinco exports historicos de documentos, servicios y listas de precios que solo eran ejercitados por sus propios tests y no tenian consumidores de runtime.
- Se conservaron las APIs activas de cada modulo y se ajustaron exclusivamente las aserciones asociadas al codigo retirado.
- No se modificaron reglas de negocio, query keys, permisos, datos ni esquema. No requiere migraciones.

## Rendimiento del dashboard y limpieza de tests

- Los graficos del Dashboard se cargan de forma diferida solo cuando existe actividad representable; metricas, navegacion y acciones permanecen disponibles en el paquete inicial.
- La carga conserva el espacio del grafico y un estado accesible para evitar saltos de layout.
- El mock de Tecnicos replica el estado controlado del filtro operativo y elimina la advertencia espuria de React durante la suite.
- No se modificaron reglas de negocio, datos, permisos, RLS ni esquema. No requiere migraciones.

## Persistencia de borradores comerciales

- La creación y la edición de borradores de Documentos comparten una única normalización del payload persistido.
- La normalización conserva las diferencias de presupuesto, remito comercial y remito interno, y evita guardar vínculos incompatibles entre esos flujos.
- La regresión unitaria cubre los tres escenarios. No se modifican emisión, stock, Caja, cuenta corriente, RLS ni esquema, y no requiere migraciones.

## Calculo de stock e invalidacion de catalogos

- El calculo de existencias, demanda, cobertura y salud vive en una funcion pura del dominio Stock; el hook de pantalla solo consulta y orquesta.
- Las importaciones de proveedores reutilizan la invalidacion canonica de proveedores y catalogos.
- Se elimino una acumulacion historica sin consumidores. Las regresiones cubren movimientos firmados, demanda manual, items historicos y antiguedad de salidas.
- No se modificaron reglas de negocio, query keys, RLS, aislamiento por `company_id` ni esquema. No requiere migraciones.

## Fecha comercial de Caja

- Caja y Totales reutilizan directamente el helper canonico de fecha comercial de Buenos Aires.
- Se retiro el alias local redundante sin cambiar inicializacion, filtros, cierres ni reglas de negocio.
- No requiere migraciones ni modifica datos, permisos, RLS o aislamiento por `company_id`.

## Normalizacion de busquedas

- La busqueda general y la busqueda natural de items comparten una normalizacion canonica de acentos, espacios y puntuacion admitida.
- Las equivalencias, sinonimos y reglas de ranking especificas de items permanecen dentro de su modulo.
- No requiere migraciones ni modifica datos, permisos, RLS o aislamiento por `company_id`.
- Se retiro el adaptador frontend de busqueda IA de items y sus pruebas aisladas porque no tenia consumidores de produccion.
- La Edge Function `item-search-ai` se conserva hasta poder descartar de forma independiente cualquier uso desplegado o externo.

## Normalizacion de CUIT

- Facturacion y Clientes comparten las funciones canonicas de normalizacion, formato y digito verificador desde `src/lib/cuit.ts`.
- Clientes conserva sus exports publicos para no romper consumidores existentes; se elimino la implementacion duplicada de Facturacion.
- No requiere migraciones ni modifica datos, permisos, RLS o aislamiento por `company_id`.

## Origen publico compartido

- Los enlaces publicos de Documentos y Servicios resuelven el origen de la aplicacion desde un unico helper en `src/lib/public-app-url.ts`.
- Se conserva la prioridad del valor definido en build, la configuracion `VITE_PUBLIC_APP_URL` y el fallback al origen actual del navegador.
- No requiere migraciones ni modifica tokens, permisos, RLS o aislamiento por `company_id`.

## Superficie publica de Rendiciones

- La forma interna del RPC de guardado de borradores permanece encapsulada en `src/features/settlements/api.ts`.
- Los consumidores conservan las mismas funciones publicas y el mismo comportamiento operativo.
- No requiere migraciones ni modifica permisos, RLS o aislamiento por `company_id`.

## Git workflow

## Proveedores: importación semántica y catálogo operativo

- Las ofertas conservan moneda por fila y las listas pueden ser ARS, USD o mixtas.
- Excel/CSV detecta localmente nombre, descripción adicional, presentación, unidades por envase, contenido y unidad desde columnas o texto del producto. El preview permite revisar moneda y presentación antes de confirmar.
- La descripción original se conserva como evidencia; los campos detectados incluyen confianza y advertencias para evitar completar datos ambiguos por adivinación.
- El catálogo usa navegación horizontal, precios no truncables y una bandeja de pedido que aparece al seleccionar productos.
- Migración de staging: `20260711173000_supplier_catalog_line_semantics.sql` (aditiva, compatible con líneas históricas y sin cambios en producción).
- La importación de Excel abre siempre una revisión estructural: marca columnas usadas/omitidas y, para listas como Frigerar, compone `Envase + Kgs`, usa `$ x Envase` como costo y conserva `$ x Kg` como referencia.
- El comparador selecciona versiones de múltiples proveedores, agrupa solo matches confirmados o descripciones normalizadas idénticas y no mezcla rankings ARS/USD sin un tipo de cambio manual.
- El pedido del proveedor puede confirmarse como orden de compra persistida. La creación es atómica, valida empresa/proveedor/versión y guarda snapshots de producto, presentación, moneda y precios.
- Migración nueva: `20260711210000_supplier_purchase_orders.sql` (campos de precio de referencia, órdenes, renglones, RLS y RPC; aplicar únicamente en staging).
- Validación pendiente fuera de automatización: importaciones con archivos reales y QA autenticada con datos de dos empresas.

This repository uses a simple linear flow to avoid branch drift:

- `main`: production only
- `staging`: demo / QA / pre-production
- `feat/*`, `fix/*`, `chore/*`: short-lived work branches created from `staging`

### Daily flow

1. Update `staging`

```sh
git checkout staging
git pull origin staging
```

2. Create a short-lived branch from `staging`

```sh
git checkout -b feat/my-change
```

3. Work normally, commit, and push the branch

```sh
git push -u origin feat/my-change
```

4. Open a PR to `staging`

- Prefer `Squash and merge` or `Rebase and merge`
- Do not use merge commits

5. After QA/demo approval, open a PR from `staging` to `main`

- Keep the promotion linear
- Do not merge `main` into `staging` manually

### Rules

- Do not work directly on `main`
- Do not keep a permanent `dev` branch unless the team explicitly restores that model
- Do not create sync branches like `sync/main-into-staging`
- If production needs a hotfix, apply it through a short-lived branch and then bring it back to `staging` with a clean PR
- After each promotion, update both local branches:

```sh
git checkout main
git pull origin main
git checkout staging
git pull origin staging
```

### Why this flow

`main` and `staging` may sometimes have different commit hashes even when the file content is the same. That is acceptable. The goal is to keep promotions predictable and the history linear so future PRs and merges stay clean.

## Technical consolidation

- Public module contracts only expose values and types with external consumers; implementation-only types and helpers remain private.
- `LineItemsTable` keeps its row shape private because no external module consumes that type.
- Price-list consultation utilities retain only selection logic used by the active workflow.
- Date rendering uses canonical business-date and timestamp formatters without feature-local passthroughs.
- The PostgreSQL driver is a development dependency because it is used only by the critical database test suite, never by the browser or Vercel runtimes.
- Item search tokenization uses its public canonical helper directly and no longer retains unused local search guidance.
- Catalog matching retains only active alias resolution paths and no longer carries an unused alias-suggestion helper.
- Import parsing exposes only the file-parser entry point; shared row and price helpers are consumed from their canonical core module.
- Customer fiscal helpers retain only validation paths used by active screens; unused future-billing snapshot scaffolding was removed.
- Service form helpers retain only payload and normalization paths used by active workflows; an unused standalone validity alias was removed.
- Vite vendor chunk rules track installed runtime dependencies and avoid unreachable package-specific branches.
- Shared stock indicators in price-list tables use one canonical component and semantic status mapping.
- Printable documents and services share the same optional metadata renderer and escaping contract.
- Stock formatting and movement validation share one exact rule for integer-only units.
- Vite keeps its static plugin list direct, without a no-op conditional filter.
