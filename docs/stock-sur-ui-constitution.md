# Stock Sur UI Constitution

Fuente de verdad normativa del producto. Toda excepción requiere una razón de UX documentada; `className` no es una variante.

## Inventario y diagnóstico

Rutas auditadas por familia: shell (`AppLayout`, `AppSidebar`, navegación, empresa, usuario), Inicio, Ítems, Combos, Stock y movimientos, Precios, Documentos, Presupuestos, Remitos, Caja y Totales, Clientes y cuenta corriente, Facturación, Proveedores, Catálogos, Importaciones, Órdenes, Servicios, Técnicos, Rendiciones, Usuarios, Configuración, autenticación, páginas públicas e impresión. También se revisaron dialogs, confirmaciones, estados de datos, paginación y acciones por fila.

La causa técnica es un rollout aditivo: `ui/page`, `common/VisualSystem`, utilidades CSS y componentes locales expresan el mismo concepto con contratos distintos. La causa de diseño es diseñar por módulo en vez de elegir un arquetipo y una primitive canónica. Resultado: cards, métricas, filtros, tablas, badges, importes y overlays cambian de anatomía.

## 1. Personalidad visual

Moderna, tecnológica, enérgica, precisa, operativa, expresiva y profesional. El producto debe reconocerse por su ritmo, tipografía, acentos controlados y claridad de datos, no por decoración. Se excluyen ERP legacy, plantilla shadcn sin identidad, neón, estética gamer/crypto, glassmorphism dominante y gradientes indiscriminados.

## 2. Core palette

- `primary`: azul-violeta de identidad; CTA, foco y selección.
- `brand-indigo`, `brand-cyan`, `brand-ink`: firma Stock Sur.
- El primario no cambia por dominio. Texto y controles mantienen contraste WCAG AA.

## 3. Domain accents

Comercial violeta; Inventario teal/cyan; Caja/Finanzas esmeralda; Compras ámbar; Servicios azul/índigo; Rendiciones magenta controlado; Administración slate. Se permiten en acento de header, icon tile, selección y visualización de datos. Nunca reemplazan colores funcionales ni colorean cada botón.

## 4. Functional colors

- Success: completado o saludable.
- Warning: requiere atención.
- Danger: error, bloqueo o acción destructiva.
- Info: contexto o proceso en curso.
- Neutral: borrador, inactivo o dato sin riesgo.

El significado es global y nunca depende sólo del color.

## 5. Surface hierarchy

`canvas` es fondo; `base` es workspace; `subtle` agrupa sin elevar; `selected` marca selección; `elevated` se reserva para overlays. Un solo borde. Shadow sólo cuando comunica elevación. No anidar superficies salvo entidades funcionalmente independientes.

## 6. Typography

Manrope para display y títulos; IBM Plex Sans para interfaz y datos. Escala: display 32/38, page 28/34, section 18/26, body 14/21, small 12/18. Microtexto menor a 12 px sólo para un contador excepcional. Uppercase sólo en eyebrow/categoría, tracking máximo `.1em`. Headers de tabla en sentence case. Importes usan números tabulares.

## 7. Spacing

Base 4 px. Escala permitida: 4, 8, 12, 16, 20, 24, 32, 40, 48. Gaps internos 8–16; secciones 24–32; bloques mayores 40–48. No introducir valores de 1–3 px salvo borde o ajuste óptico documentado.

## 8. Radius

Controles 10 px; superficies 14 px; overlays 12–16 px; pills 999 px. El radio no comunica dominio.

## 9. Borders

Un borde de 1 px con token `border`. Acento de dominio sólo en borde destacado o selección, no en todos los lados. Focus ring separado del borde.

## 10. Shadows

`shadow-xs` para separación mínima y `shadow-lg` para overlays. Las cards estáticas no ganan shadow/hover. No mezclar shadows locales.

## 11. Motion

120–200 ms para feedback y navegación; easing estándar. Animación comunica cambio de estado, no adorna. Respetar `prefers-reduced-motion`; evitar layout shifts en loading.

## 12. Iconography

Lucide, stroke consistente: 16 px en controles, 20 px en navegación, 24 px en estados. Icon-only exige nombre accesible, foco y tooltip cuando no sea inequívoco. Acciones de fila son neutrales; rojo sólo para destrucción confirmada.

## 13. Page archetypes

- Analytical Dashboard: header contextual → período → métricas (máximo cuatro por fila) → visualización → atención.
- Operational List: header → resumen opcional → toolbar → única superficie de tabla → paginación.
- Tabbed Workspace: header con tabs → toolbar estable → workspace. Tabs cambian vista, no filtran.
- Entity Detail: identidad/status/acciones → resumen → secciones por jerarquía/divider.
- Transaction Flow: página completa si tiene más de ocho campos, líneas o secciones; footer sticky.
- Administration: header estándar → navegación secundaria estable → secciones de configuración.

Públicas, impresión y Auth comparten marca/tokens, no el shell autenticado.

## 14. Page widths and gutters

Shell, header y contenido: máximo 1600 px; detalle legible 1200 px; administración/tabla de detalle hasta 1440 px. Gutters 16 px mobile, 24 px tablet, 32 px desktop. No hay anchos locales arbitrarios.

## 15. Header anatomy

`standard`: eyebrow opcional, título, descripción operativa, metadata y CTA. `workspace`: lo anterior más tabs anclados. `analytical`: contexto/período/acciones y motivo gráfico sutil. No toda página necesita hero. Una sola CTA primaria; secundarias agrupadas.

## 16. Tables

Comfortable: header 44 px, fila mínima 52 px, padding X 16, texto 14/20. Compact: header 40 px, fila 44 px, padding X 12, texto 13/18. Sticky es opt-in. Hover y selected tienen tokens diferentes. Scroll pertenece al workspace; paginación queda fuera del scroll.

`PrimaryCell`: título 14/20 + metadata 12/16, máximo dos líneas y tooltip al truncar. `MoneyCell`: moneda e importe unidos, derecha, tabular, `nowrap`. `StatusCell`: taxonomía global. Máximo una acción dominante y dos visibles; el resto en `…`. Loading usa filas estables; empty/error/retry usan `DataState`.

## 17. Cards

Variantes: Metric (p20), Summary (p20–24), Action (p16–20), Workspace (p0 para tabla, p20–24 formulario), Alert, EntityListItem y Empty. La base es estática y sin hover. No usar Card como separador por defecto.

## 18. Badges

Altura 24, padding X 8, texto 12/16 semibold, radio pill, borde 1, icono 12–14. Tipos: `StatusBadge` (workflow), `HealthBadge` (condición), `CategoryBadge` (clasificación), `CountBadge` (cantidad), `InfoBadge` (contexto excepcional). Moneda, documento, fecha y metadata común no son badges.

## 19. Filters

Controles de 40 px y radio 10. Orden: búsqueda (280–360 px) → frecuentes → avanzados → columnas → limpiar → cantidad. Labels persistentes en fechas/rangos y campos ambiguos; búsqueda puede usar placeholder con `aria-label`. Chips sólo para filtros activos. En mobile se apila búsqueda y se agrupan secundarios; no toolbar permanente de dos filas.

## 20. Tabs

Tabs cambian workspace. Una anatomía y target mínimo 40 px; active con texto, indicador y `aria-selected`. Scroll horizontal controlado en mobile. No usar tabs como botones, filtros o pasos de formulario.

## 21. Forms

Control 40 px (44 táctil cuando corresponda), label visible para datos operativos, hint antes del error, error específico junto al campo. Grilla máxima de dos columnas salvo líneas transaccionales. Acciones persistentes en flujos largos. No perder datos al cerrar o cambiar contexto.

## 22. Dialogs

Quick 420 px; Confirmation 440 px; Form 640 px; Command 720 px. Máximo `min(88dvh, 900px)`, padding 16 mobile/24 desktop. El shell nuevo usa `DialogBody` scrolleable entre header y footer; se adopta de forma opt-in para no alterar dialogs legacy hasta su migración. Escape, trap y restitución de foco son obligatorios. Formularios complejos/importaciones son página completa, no dialog gigante.

## 23. Drawers

Detail drawer 480–560 px para consulta contextual breve y reversible. No sustituye navegación de entidad ni edición compleja. Header y footer fijos, body scrolleable, cierre accesible y retorno de foco.

## 24. Feedback

Cada operación crítica muestra loading, éxito, error accionable y confirmación si corresponde. Toast confirma eventos transitorios; errores que bloquean permanecen en contexto. Empty explica qué falta y ofrece CTA sólo si el usuario puede actuar.

## 25. Responsive

Validar 1920, 1440, 1366×768, 1280, tablet, mobile y zoom 125/150%. No ocultar recortes con `overflow-hidden`. Priorizar columnas; tablas pueden transformarse en `EntityListItem` en mobile. Toolbars envuelven, importes no truncan, dialogs mantienen footer accesible.

## 26. Accessibility

WCAG AA, navegación completa con Tab/Shift+Tab/Enter/Espacio/Escape, foco visible, skip link, landmarks, nombres accesibles y target coherente. Estado nunca sólo por color. El cambio de ruta lleva foco al contenido; overlays lo devuelven al trigger.

## 27. Anti-patterns

Prohibidos: una séptima arquitectura sin ADR; clases locales que redefinen densidad; card soup; uppercase micro; badges para metadata; acciones arcoíris; importes truncados; dialog como escape hatch; gradientes por preferencia; ancho local; copy sobre el rediseño; invalidación/caché sin `companyId`.

## 28. Examples

- Documentos: Operational List + `FilterToolbar` + `DataTable` comfortable + `MoneyCell` + `StatusBadge`.
- Stock: Tabbed Workspace; resumen analytical sólo dentro de su tab; movimientos compactos.
- Caja Totales: Analytical, período en header y métricas compartidas.
- Usuario: Administration + secciones; permisos peligrosos con Confirmation.
- Importación: Transaction Flow full-page, errores por fila y footer sticky.

## Matriz de componentes

| Componente | Variantes permitidas | Uso | No usar para |
|---|---|---|---|
| PageHeader | standard, workspace, analytical | Contexto y acciones | Decoración arbitraria |
| Surface/Card | metric, summary, action, workspace, alert, list, empty | Unidad funcional | Agrupar cada bloque |
| DataTable | comfortable, compact; sticky opcional | Datos comparables | Layout general |
| Badge | status, health, category, count, info | Señal compacta | Fecha, dinero, metadata |
| FilterToolbar | search, frequent, advanced, active, count | Refinar resultados | Navegación |
| Tabs | workspace | Cambiar vista hermana | Filtro o CTA |
| Dialog | quick, form, confirmation, command | Tarea breve | Editor/importación compleja |
| Drawer | detail | Consulta contextual | Flujo transaccional |
| Feedback | loading, empty, error, success | Estado de operación | Copy decorativo |
| RowActions | primary + overflow | Acciones por entidad | Botonera multicolor |

## Ownership y compatibilidad

### CANONICAL

- `AppLayout` es el único dueño del viewport autenticado, offset de navegación, gutter exterior y ancho máximo del shell.
- `ui/page.tsx` es dueño de composición: `PageContainer`, `PageHeader`, `PageTabs` y `FilterToolbar`. No define celdas, estados de dominio ni formatos de datos.
- `common/VisualSystem.tsx` es dueño de presentación semántica reutilizable: `MetricCard/MetricGrid`, `PrimaryCell/MoneyCell`, `StatusBadge`, `CountBadge`, `InfoBadge`, `HealthBadge` y `CategoryBadge`.
- `DataTable` es la única API para datasets operativos estándar. `index.css` provee tokens y recetas base; no es un catálogo alternativo para las rutas.

### COMPATIBILITY

`FilterBar`, `StatCard`, `DataCard`, `MetricHeroCard`, `SectionCard`, `OperationalTableShell` y `CompactBadge` existen solamente para consumidores actuales. Son adapters o aliases, no APIs alternativas.

### DEPRECATED

Los símbolos de compatibilidad están marcados `@deprecated`. Cada PR de migración reemplaza sus consumidores por el canonical equivalente; el adapter se elimina cuando su búsqueda global llega a cero. `AmountDisplay` puede seguir como formato genérico fuera de tablas; dentro de tablas se usa `MoneyCell`.

### DO NOT USE

Las pantallas nuevas no deben importar `FilterBar`, `StatCard`, `DataCard`, `MetricHeroCard`, `SectionCard`, `OperationalTableShell` ni `CompactBadge`; tampoco `ui/Table` crudo para listas operativas, `ui/Badge` crudo para estados de dominio, ni clases `.surface-card`, `.filter-strip`, `.data-panel`, `.stat-tile` o `.status-chip` directamente desde rutas. Excepciones de tabla editable, impresión o flujo transaccional requieren justificación en el PR.

## Roadmap

1. Constitution, tokens, primitives y shell/navigation.
2. Operational Lists: Documentos, Ítems, Clientes, Proveedores.
3. Tabbed Workspaces: Stock, Movimientos, Precios.
4. Analytical: Inicio, Stock Resumen, Caja Resumen, Totales.
5. Procurement: Catálogos, Importaciones, Comparador, Órdenes.
6. Commercial detail: documentos, cuenta corriente, facturación.
7. Services: trabajos, documentos, técnicos, rendiciones.
8. Administration: usuarios, empresas, roles, permisos, configuración.
9. Forms, dialogs, drawers y feedback global.
10. Responsive, accessibility y visual QA cross-app.

Cada PR parte de `origin/staging`, llega a `staging`, incluye screenshots y QA autenticada de sus rutas, y no toca producción.
