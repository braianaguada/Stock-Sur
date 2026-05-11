# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

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

## Estado actual de staging

`staging` es la rama de QA/demo donde se prueban los cambios antes de promoverlos a `main`.
Al 2026-05-11, los cambios principales incorporados en `staging` son:

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
- Combos de productos v1:
  - nueva ruta `/combos` para crear combos reutilizables por empresa
  - CRUD mejorado con edicion de cabecera, activacion/desactivacion y editor de lineas
  - formulario estable: no se pisa al tipear ni al refetch de queries mientras se edita, y al seleccionar un combo existente espera a cargar sus lineas antes de hidratar el formulario
  - si hay cambios locales sin guardar, cambiar de combo o limpiar pide confirmacion antes de descartar
  - cada combo agrupa productos reales con cantidades, notas y orden simple
  - en documentos, el buscador permite agregar combos con multiplicador y se expanden a lineas reales
  - no existe stock propio ni precio propio del combo en esta fase
  - la logica de documentos sigue aplicando precios, redondeo y edicion manual por linea
- Guardado atómico de combos:
  - `/combos` guarda cabecera + lineas con la RPC `upsert_product_combo_with_lines`
  - si falla una validacion o una linea, la operacion se revierte completa en Supabase
  - al editar, se reemplaza el set de lineas dentro de la misma transaccion
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
  - modelo base para trabajos generales por empresa y cliente, con estado, prioridad, descripcion, apertura/cierre y auditoria minima
  - modelo base para servicios dentro de un trabajo, con fecha/hora programada, estado, tareas realizadas, notas y tecnicos asignados
  - relacion `service_job_service_technicians` para asignar multiples tecnicos a cada servicio sin duplicar el mismo tecnico en el mismo servicio
  - listado con busqueda por trabajo/cliente, filtro por estado, tecnico y rango de apertura
  - detalle lateral de trabajo con servicios asociados y CRUD minimo de trabajos/servicios
  - no registra materiales, no vincula remitos, no crea remitos y no genera stock, caja, documentos, facturacion ni cuenta corriente
  - los trabajos bloquean clientes ocasionales en la migracion y la UI solo lista clientes regulares
  - RLS usa permisos existentes `customers.view`, `customers.create` y `customers.edit` por cercania funcional con clientes/tecnicos hasta crear permisos especificos de trabajos
  - se corrigio la hidratacion de sesion para que una ruta protegida como `/service-jobs` cargue directo por URL sin rebotar al dashboard
- Migraciones nuevas:
  - `supabase/migrations/20260508143000_duplicate_documents.sql`
  - `supabase/migrations/20260508200000_company_price_rounding_settings.sql`
  - `supabase/migrations/20260508150000_product_combos.sql`
  - `supabase/migrations/20260508160000_remote.sql`
  - `supabase/migrations/20260508170000_product_combos_rpc.sql`
  - `supabase/migrations/20260508190000_cash_expenses_ui_support.sql`
  - `supabase/migrations/20260511120000_service_jobs_base.sql`
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
  - `src/features/combos/lib/buildComboLines.test.ts` cubre expansion de combo, multiplicador y validacion de entradas invalidas
  - `src/features/combos/lib/comboForm.test.ts` cubre la sincronizacion estable del formulario
  - `src/features/documents/components/DocumentsEditorDialog.test.tsx` cubre el render del editor con la nueva API de combos
  - `src/features/documents/hooks/useDocumentsMutations.test.tsx` ahora mockea Supabase y valida la mutacion sin depender de env real
- Cobertura QA agregada para gastos de caja:
  - `src/features/cash/utils.test.ts` cubre validacion de monto/categoria/descripcion, suma de gastos activos, exclusion de anulados y efecto de gastos efectivo/no efectivo sobre el efectivo esperado
- Cobertura QA agregada para totales de caja:
  - `src/features/cash/lib/cashTotals.test.ts` cubre exclusion de ventas/gastos anulados, gasto efectivo contra efectivo neto, gasto no efectivo fuera de caja fisica, cuenta corriente separada, agrupacion por dia, sumatoria del periodo y rangos dia/semana/mes/personalizado
- Cobertura QA agregada para estado de cuenta:
  - `src/features/customer-account/lib/accountStatement.test.ts` cubre debito pendiente, debito vencido, credito como pago, saldo, filtro por fechas, exclusion de ocasional, referencia de remito, factura externa en filas y empty state
  - `src/lib/formatters.test.ts` cubre que `2026-05-09` se muestre como `09/05/2026` sin corrimiento de dia
  - `src/features/customer-account/lib/routes.test.ts` cubre el link filtrado `/customer-account?customerId=<id>`
- Cobertura QA agregada para trabajos/servicios:
  - `src/features/service-jobs/lib/serviceJobForm.test.ts` cubre payload valido de trabajo, bloqueo de titulo vacio, servicio con tecnicos, deduplicacion de tecnicos, servicio sin materiales valido y normalizacion de estado/prioridad
  - `src/App.routes.smoke.test.tsx` cubre que `/service-jobs` monte sin romper
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

- `npm run db:push:staging`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test -- --run src/features/service-jobs/lib/serviceJobForm.test.ts src/App.routes.smoke.test.tsx`
- QA funcional contra staging con usuario real: login, carga directa de `/service-jobs`, alta/edicion de trabajo, alta/edicion de servicio, tecnico asignado, bloqueo de tecnico duplicado, filtros por estado/titulo/cliente/tecnico e integridad de tablas criticas

Notas:

- `npm run test` deja `src/features/db/criticalDb.test.ts` en `skipped` si no hay `PGPASSWORD` configurado.
- La migracion de trabajos/servicios se debe aplicar en staging con `npm run db:push:staging` antes de probar `/service-jobs`.
- En staging no habia tecnicos cargados al iniciar el QA manual; se creo un tecnico QA en la entidad `technicians` existente para validar la asignacion desde trabajos/servicios.
- La migracion de combos ya se aplico en staging con `npm run db:push:staging --include-all` por una diferencia de historial remoto.
- La migracion de gastos de caja se aplico en staging con `npm run db:push:staging`.
- El guardado de combos ya no persiste parcialidades cabecera/lineas: la escritura pasa por una RPC transaccional en Supabase.
- Fix de estabilidad validado en preview: seleccionar un combo existente ya no muestra una linea vacia por hidratar antes de recibir `product_combo_lines`.
- Limitacion restante de combos: la UI sigue siendo simple y no hay borrado fisico, importacion masiva ni combos dentro de combos.
- Limitacion restante de gastos: no hay adjuntos reales, OCR, aprobaciones, reportes mensuales ni edicion de gastos cerrados; si un gasto activo se cargo mal, se anula y se registra nuevamente.
- Limitacion restante de totales: no hay exportacion Excel, graficos avanzados ni detalle transaccional expandible por dia; el reporte se calcula en frontend con queries por rango y limite operativo de 5000 ventas/gastos por consulta.
- Limitacion restante de estado de cuenta: no hay imputacion avanzada de pagos por factura/remito, exportacion Excel, intereses, alertas ni conciliacion bancaria; el estado por debito se calcula como estimacion del saldo del cliente.
- Limitacion restante de trabajos/servicios: no hay vinculo con remitos/documentos, materiales usados, costos, facturacion, reportes, calendario, adjuntos ni checklist tecnico; el guardado de tecnicos de un servicio reemplaza asignaciones en dos pasos desde la UI.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

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

1. ConfiguraciÃ³n mÃ­nima gratis en Supabase:

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

## Database migrations

Migrations are stored in:

`supabase/migrations`

Step 1 - deploy to staging:

```sh
npm run db:push:staging
```

Step 2 - verify staging.

Step 3 - deploy to production:

```sh
npm run db:push:prod
```

## Git workflow

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
