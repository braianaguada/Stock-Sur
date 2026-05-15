# Sistema visual inicial

Esta fase toma Caja como modulo piloto. No cambia reglas de negocio, calculos, permisos, rutas ni base de datos.

## Iteracion 2 de Caja

La primera iteracion del PR #225 creo componentes, pero no cambio lo suficiente la arquitectura visual de `/cash`. El resultado seguia siendo header + tabs + muchas cards + formulario fijo + tabla, por lo que Caja no se sentia como un panel operativo diario.

### Inspeccion visual real

- Se levanto la app local con el `.env` existente y se abrio `/cash`; la ruta redirige a `/auth`.
- El PR tiene preview de Vercel disponible, pero tambien requiere sesion para revisar datos reales.
- No habia credenciales ni sesion reutilizable en el contexto, por lo que no se crearon datos ni se intento forzar autenticacion.
- La decision de redisenio se baso en la inspeccion hasta autenticacion, la estructura real del codigo de Caja y el diagnostico visual de las capturas revisadas por producto.

Observaciones aplicadas:

- Lo primero que debia verse era `Total vendido del dia`, no una grilla de metricas similares.
- `Nueva venta` no debia dominar `Gastos`, `Cierre` ni vistas secundarias.
- `Pendientes` suele ser una excepcion operativa; no debe ocupar una tab principal si no hay items.
- `Historial` compite con `Totales`; debe pasar a acceso secundario hasta definir su rol.
- `Cierre` necesitaba una pantalla de decision centrada en efectivo esperado, estado y acciones.

## Auditoria visual global

### Headers

- `Items`, `Stock`, `Proveedores`, `Precios`, `Documentos`, `Servicios`, `Trabajos`, `Clientes`, `Usuarios`, `Configuracion`, `Totales` y `Caja` ya usan `PageHeader` o un patron compatible.
- `Combos` mantiene una estructura mas local, con header y acciones embebidas en la pantalla.
- Hay diferencias en uso de eyebrow, descripcion, badges secundarios y acciones a la derecha. La regla inicial queda: eyebrow de area, titulo corto, descripcion operativa, acciones principales a la derecha y tabs debajo si existen.

### Cards y metricas

- Dashboard, Stock, Trabajos, Totales, Precios y Caja usan cards de resumen, pero con pesos visuales distintos.
- Caja tenia muchas cards compitiendo con el mismo peso y valores con `truncate/ellipsis`.
- Totales y Dashboard muestran importes relevantes que deberian migrar a `AmountDisplay`.
- Regla inicial: una metrica principal usa `MetricHeroCard`; metricas secundarias usan `MetricCard` dentro de `MetricGrid`; alertas o estados no deben competir con la metrica principal.

### Tablas

- Hay dos patrones: `DataTable` compartido y tablas HTML manuales.
- `Items`, `Documentos`, `Stock`, `Clientes`, `Proveedores` y varias tablas internas usan `DataTable`.
- `CashTotals`, `Gastos`, `Trabajos` y algunos dialogos todavia tienen tablas manuales.
- Las acciones de fila ya tienden a icon buttons, pero no siempre tienen la misma densidad ni ubicacion.
- Regla inicial: tablas operativas dentro de `OperationalTableShell`, con contador, filtros compactos, empty state claro y scroll horizontal cuando corresponda.

### Filtros

- `FilterBar` existe y se usa en varios modulos.
- Hay inconsistencias de ancho en buscadores, selects y fechas. Algunos filtros viven en cards separadas.
- Regla inicial: buscador primero, selects despues, fechas agrupadas, limpiar filtros al final cuando exista.

### Formularios

- Formularios principales viven en dialogos (`EntityDialog`) o panels/cards laterales.
- Labels, helpers y errores no siempre tienen la misma densidad.
- Acciones primarias/secundarias son generalmente claras, pero las acciones destructivas deben mantenerse separadas y confirmadas.

### Tabs y subsecciones

- Caja: `Hoy`, `Gastos`, `Pendientes`, `Cierre`, `Historial`.
- Precios y Stock tambien usan tabs para separar vistas operativas.
- Riesgo detectado: tabs que acumulan historico y pueden duplicar otros modulos, especialmente `Caja > Historial` frente a `Totales`.

### Badges y estados

- Hay badges por modulo para activo/inactivo, documentos, servicios, caja y stock.
- Los textos y colores no estan totalmente unificados.
- Regla inicial: badges compactos en tablas, textos cortos, no romper filas; reutilizar `CompactBadge` para metadatos simples y mantener mapas de estado por dominio hasta una fase de consolidacion.

### Importes y numeros

- Caja tenia riesgo concreto de cortes visuales en importes.
- Totales, Estado de cuenta, Documentos, Precios y Dashboard son los siguientes candidatos.
- Regla inicial: importes relevantes con `AmountDisplay`, `tabular-nums`, `title` con valor completo y sin `ellipsis` en montos principales.

### Acciones

- Acciones existentes: crear, editar, ver, imprimir, duplicar, anular, eliminar, archivar, restaurar, recalcular, vincular/desvincular.
- Acciones destructivas aparecen con tono rojo, pero no siempre separadas semanticamente.
- Regla inicial: destructivas con confirmacion, texto de consecuencia y separadas visualmente de acciones normales cuando haya espacio.

### Layout general

- Predominan: header + filtros + tabla, cards + tabla, formulario + tabla y detalle en dialogo.
- Caja queda como piloto de panel operativo: metrica hero, metricas secundarias y area de trabajo responsive.

## Arquitectura de informacion y navegacion

La navegacion plana actual ya esta cerca del limite: hay muchos modulos visibles y nuevos dominios previstos como pedidos a proveedores, ordenes de compra, facturacion, reportes y tesoreria.

Recomendacion para la siguiente fase:

- Mantener el top nav actual por ahora para no romper el flujo.
- Preparar agrupacion por areas:
  - Operacion: Dashboard, Caja, Documentos, Trabajos, Servicios, Tecnicos.
  - Inventario: Items, Stock, Combos, Precios, Proveedores.
  - Clientes y cuentas: Clientes, Estado de cuenta, Totales.
  - Administracion: Usuarios, Configuracion.
- Evaluar sidebar agrupado o top nav con menu "Mas" para pantallas medianas.
- Convertir Dashboard en centro operativo con accesos rapidos: Nueva venta, Nuevo remito, Consultar producto/precio, Registrar gasto, Ver caja del dia, Trabajos abiertos, Deudas pendientes y Stock bajo.

## Componentes creados

Archivo: `src/components/common/VisualSystem.tsx`.

- `AmountDisplay`: importes/numeros con `tabular-nums`, valor completo en `title` y tamanios `sm`, `md`, `lg`, `hero`.
- `MetricHeroCard`: metrica principal del modulo.
- `MetricCard`: metrica secundaria.
- `MetricGrid`: grilla responsive de metricas.
- `OperationalTableShell`: contenedor para tablas operativas con titulo, descripcion, contador y acciones.
- `SectionCard`: panel base para secciones.
- `CompactBadge`: badge compacto para metadatos.
- `PageHeader` suma `divider` opcional y conserva compatibilidad.

## Caja como piloto

- Header mantiene `PageHeader`, fecha operativa, accion `Nueva venta`, acceso secundario a historial y solo tres tabs principales: `Hoy`, `Gastos`, `Cierre`.
- El resumen se reemplaza por `CashOverviewPanel`: un bloque unico con `Total vendido del dia`, `Efectivo a rendir`, `Gastos efectivo`, `Otros medios`, `Cuenta corriente` y composicion compacta por medio de pago.
- Se descarta la grilla plana de 8/9 cards iguales para Caja; el patron nuevo es panel hero + facts operativos + breakdown.
- `Movimientos del dia` queda como protagonista de `Hoy`; `Nueva venta` pasa a panel secundario dentro de esa vista.
- `Gastos` ya no comparte pantalla con `Nueva venta`; se centra en registrar gasto, resumen efectivo/no efectivo y listado.
- `Cierre` se redisenia como pantalla de decision: efectivo esperado en primer plano, estado de cierre, detalle de control, observaciones y acciones.
- Importes de Caja usan `AmountDisplay` en resumen, venta, movimientos y cierre.

## Decision sobre tabs de Caja

- `Hoy`: mantener como vista principal.
- `Gastos`: mantener; separar gasto efectivo/no efectivo y anulados visibles sin contaminar totales.
- `Pendientes`: deja de ser tab principal. Si hay pendientes, se muestran como estado/accion contextual dentro del resumen y abren una vista secundaria. Si no hay pendientes, no ocupan espacio principal.
- `Cierre`: mantener; debe ser la vista de control y bloqueo.
- `Historial`: deja de ser tab principal. Queda como acceso secundario `Ver historial` para no competir con `Totales` mientras se define si se fusiona, renombra o mueve en una fase posterior.

## Componentes especificos de Caja

- `CashOverviewPanel`: patron recomendado para modulos financieros con una metrica dominante, facts operativos y breakdown compacto.
- `CashClosureTab`: usa un layout de decision en vez de una grilla de cards equivalentes.
- `CashSalesTab`: sigue usando `OperationalTableShell`, pero ahora vive como contenido principal de `Hoy`.

## Backlog visual sugerido

1. Totales: tablas manuales y resumen financiero; reutilizar `AmountDisplay`, `MetricCard`, `OperationalTableShell`; prioridad alta.
2. Estado de cuenta: importes y estados contables; reutilizar `AmountDisplay`, `CompactBadge`, `OperationalTableShell`; prioridad alta.
3. Documentos: filtros y acciones complejas; reutilizar `OperationalTableShell`, `CompactBadge`; prioridad alta.
4. Trabajos/Servicios: muchos estados y dialogos; reutilizar `CompactBadge`, `PageHeader`, `FilterBar`; prioridad media-alta.
5. Precios: densidad de tabla y chips de calculo; reutilizar `AmountDisplay`, `MetricCard`; prioridad media.
6. Productos: ya usa varios patrones, necesita pulido de densidad; reutilizar `OperationalTableShell`; prioridad media.
7. Combos: header y filtros menos alineados; reutilizar `PageHeader`, `FilterBar`; prioridad media.
8. Clientes/Proveedores: tablas bastante estables; consolidar badges y acciones; prioridad media-baja.
9. Configuracion: formularios largos; reutilizar `SectionCard` y reglas de formulario; prioridad baja.

## Validaciones de esta fase

- Sin migraciones.
- No se ejecuto `db:push`.
- Validaciones esperadas antes de merge: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.

## Limitaciones

- No se redisenio la navegacion completa.
- No se migraron todos los modulos al sistema visual.
- Los mapas de estados por dominio siguen separados.
- Las vistas de impresion se auditaron como superficie existente, pero no se modificaron.
