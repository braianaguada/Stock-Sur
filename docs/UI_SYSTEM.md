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

## Iteracion 3 de Caja

La segunda iteracion mejoro la jerarquia, pero todavia dejaba signos de wrapper visual: header alto, controles separados, pendientes con CTA propio, resumen con badges redundantes, `Gastos no efectivo` como naming poco operativo e historial visualmente debil.

### QA visual real

- Se volvio a levantar la app local y se intento abrir `/cash`.
- La ruta redirige a `/auth`; no habia sesion ni credenciales disponibles en el entorno.
- No se crearon datos, no se forzo autenticacion y no se tocaron variables de produccion.
- La auditoria de esta iteracion se hizo sobre la implementacion vigente de Caja, los componentes reales y el diagnostico visual aportado por producto.

### Decisiones nuevas

- Header: Caja usa un encabezado compacto propio, con titulo, estado, `Nueva venta`, `Ver historial` y fecha operativa en una misma linea responsive. La descripcion queda corta y secundaria.
- Pendientes: deja de tener CTA y protagonismo. Si aparece un estado tecnico sin comprobante, se muestra como nota secundaria, no como accion central ni tab.
- Naming: `Gastos no efectivo` se reemplaza por `Gastos fuera de caja`. Es mas claro para operacion porque describe egresos registrados que no reducen el efectivo fisico a rendir.
- Resumen: `CashOverviewPanel` queda mas limpio: protagonista unico `Total vendido del dia`, cuatro facts operativos y composicion como lista, no como mini-cards equivalentes.
- Hoy: movimientos queda como protagonista; el empty state se disena como estado intencional; `Nueva venta` queda como panel lateral secundario.
- Gastos: se refuerza como subpantalla propia, con resumen de egresos arriba del listado y formulario independiente.
- Cierre: se organiza como decision final: resultado del cierre, estado, componentes, observaciones y acciones.
- Historial: queda como vista secundaria, con filas resumidas por cierre: fecha, estado, total ventas, efectivo, gastos, otros medios y accion `Ver resumen`.
- Modal de resumen: se reduce el ruido de cards, se destaca efectivo a rendir y se agrupan importes secundarios en una grilla de lectura.

## Auditoria visual global

### Headers

- `Items`, `Stock`, `Proveedores`, `Precios`, `Documentos`, `Servicios`, `Trabajos`, `Clientes`, `Usuarios`, `Configuracion`, `Totales` y `Caja` ya usan `PageHeader` o un patron compatible.
- `Combos` mantiene una estructura mas local, con header y acciones embebidas en la pantalla.
- Hay diferencias en uso de eyebrow, descripcion, badges secundarios y acciones a la derecha. La regla inicial queda: eyebrow de area, titulo corto, descripcion operativa, acciones principales a la derecha y tabs debajo si existen.

### Cards y metricas

- Dashboard, Stock, Trabajos, Totales, Precios y Caja usan cards de resumen, pero con pesos visuales distintos.
- Caja tenia muchas cards compitiendo con el mismo peso y valores con `truncate/ellipsis`.
- Totales y Dashboard muestran importes relevantes que deberian migrar a `AmountDisplay`.
- Regla consolidada: todas las métricas usan `MetricCard` dentro de `MetricGrid`; el arquetipo define cuál es primaria y las alertas no compiten con ella.

### Tablas

- Hay dos patrones: `DataTable` compartido y tablas HTML manuales.
- `Items`, `Documentos`, `Stock`, `Clientes`, `Proveedores` y varias tablas internas usan `DataTable`.
- `CashTotals`, `Gastos`, `Trabajos` y algunos dialogos todavia tienen tablas manuales.
- Las acciones de fila ya tienden a icon buttons, pero no siempre tienen la misma densidad ni ubicacion.
- Regla consolidada: tablas operativas con `DataTable` dentro de una superficie canónica, filtros compactos, empty state claro y scroll horizontal cuando corresponda.

### Filtros

- `FilterToolbar` es el único contenedor canónico de filtros y alinea controles etiquetados o sin etiqueta por su base.
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
- Regla consolidada: badges compactos en tablas, textos cortos y mapas semánticos por dominio mediante `StatusBadge`, `InfoBadge`, `CountBadge`, `HealthBadge` o `CategoryBadge`.

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
- `MetricCard`: metrica secundaria.
- `MetricGrid`: grilla responsive canónica de dos, tres o cuatro métricas.
- `DataTable`: tabla operativa estándar dentro de una superficie `Card` cuando corresponde.
- `DialogActionGrid`: acciones de overlays con tamaño y alineación consistentes.
- Badges semánticos: `StatusBadge`, `InfoBadge`, `CountBadge`, `HealthBadge` y `CategoryBadge`.
- `PageHeader` suma `divider` opcional y conserva compatibilidad.

## Caja como piloto

- Header usa una variante compacta especifica de Caja: titulo, estado, acciones y fecha operativa quedan alineados en la franja superior; solo tres tabs principales: `Hoy`, `Gastos`, `Cierre`.
- El resumen usa `CashOverviewPanel`: un bloque unico con `Total vendido del dia`, `Efectivo a rendir`, `Gastos efectivo`, `Otros medios`, `Cuenta corriente` y composicion compacta por medio de pago.
- Se descarta la grilla plana de 8/9 cards iguales para Caja; el patron nuevo es panel hero + facts operativos + breakdown.
- `Movimientos del dia` queda como protagonista de `Hoy`; `Nueva venta` pasa a panel secundario dentro de esa vista.
- `Gastos` ya no comparte pantalla con `Nueva venta`; se centra en registrar gasto, resumen efectivo/no efectivo y listado.
- `Cierre` se redisenia como pantalla de decision: efectivo esperado en primer plano, estado de cierre, detalle de control, observaciones y acciones.
- Importes de Caja usan `AmountDisplay` en resumen, venta, movimientos y cierre.

## Decision sobre tabs de Caja

- `Hoy`: mantener como vista principal.
- `Gastos`: mantener; separar gasto efectivo/no efectivo y anulados visibles sin contaminar totales.
- `Pendientes`: deja de ser tab principal y deja de tener CTA. Si aparece un caso tecnico sin comprobante, se informa como nota secundaria y no como flujo central de Caja.
- `Cierre`: mantener; debe ser la vista de control y bloqueo.
- `Historial`: deja de ser tab principal. Queda como acceso secundario `Ver historial` para no competir con `Totales` mientras se define si se fusiona, renombra o mueve en una fase posterior.

## Componentes especificos de Caja

- `CashOverviewPanel`: patron recomendado para modulos financieros con una metrica dominante, facts operativos y breakdown compacto en formato lista.
- `CashClosureTab`: usa un layout de decision en vez de una grilla de cards equivalentes.
- `CashSalesTab`: usa `DataTable` dentro de la superficie principal de `Hoy`.
- `CashHistoryTab` y `CashClosurePreviewDialog`: historial secundario con filas resumen y modal de lectura financiera, no una grilla pesada de cards.

## Backlog visual sugerido

1. Totales: tablas manuales y resumen financiero; reutilizar `AmountDisplay`, `MetricCard` y `DataTable`; prioridad alta.
2. Estado de cuenta: importes y estados contables; reutilizar `AmountDisplay`, badges semánticos y `DataTable`; prioridad alta.
3. Documentos: filtros y acciones complejas; reutilizar `DataTable`, `DialogActionGrid` y badges semánticos; prioridad alta.
4. Trabajos/Servicios: muchos estados y diálogos; reutilizar badges semánticos, `PageHeader` y `FilterToolbar`; prioridad media-alta.
5. Precios: densidad de tabla y chips de calculo; reutilizar `AmountDisplay`, `MetricCard`; prioridad media.
6. Productos: ya usa varios patrones, necesita pulido de densidad; reutilizar `DataTable`; prioridad media.
7. Combos: header y filtros menos alineados; reutilizar `PageHeader` y `FilterToolbar`; prioridad media.
8. Clientes/Proveedores: tablas bastante estables; consolidar badges y acciones; prioridad media-baja.
9. Configuración: formularios largos; reutilizar `Card` y reglas canónicas de formulario; prioridad baja.

## Validaciones de esta fase

- Sin migraciones.
- No se ejecuto `db:push`.
- Validaciones esperadas antes de merge: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.

## Limitaciones

- No se redisenio la navegacion completa.
- No se migraron todos los modulos al sistema visual.
- Los mapas de estados por dominio siguen separados.
- Las vistas de impresion se auditaron como superficie existente, pero no se modificaron.
