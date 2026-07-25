# Catálogo de componentes frontend

Este catálogo es el índice operativo. Los contratos normativos viven en la [Constitución UI](stock-sur-ui-constitution.md).

| Necesidad | API canónica | Ubicación | Notas |
|---|---|---|---|
| Contenedor de ruta | `PageContainer` | `components/ui/page.tsx` | Declara el arquetipo y evita anchos/gutters locales. |
| Encabezado | `PageHeader` | `components/ui/page.tsx` | Variantes standard, workspace y analytical. Una CTA primaria. |
| Tabs de workspace | `PageTabs` | `components/ui/page.tsx` | Navegación hermana, no filtros ni pasos. |
| Filtros | `FilterToolbar` | `components/ui/page.tsx` | Búsqueda, filtros, columnas, limpiar y cantidad. |
| Dataset operativo | `DataTable` | `components/data-table` | Densidad comfortable/compact; estados estables. |
| Métricas | `MetricGrid`, `MetricCard` | `components/common/VisualSystem.tsx` | Hasta cuatro por fila; una jerarquía compartida. |
| Celda principal | `PrimaryCell` | `components/common/VisualSystem.tsx` | Título y metadata; máximo dos líneas. |
| Importe en tabla | `MoneyCell` | `components/common/VisualSystem.tsx` | Derecha, tabular y sin corte. |
| Estado de workflow | `StatusBadge` | `components/common/VisualSystem.tsx` | La etiqueta acompaña al color. |
| Condición/salud | `HealthBadge` | `components/common/VisualSystem.tsx` | No usar para workflow. |
| Clasificación | `CategoryBadge` | `components/common/VisualSystem.tsx` | Categoría, nunca metadata común. |
| Cantidad | `CountBadge` | `components/common/VisualSystem.tsx` | Conteos compactos. |
| Contexto excepcional | `InfoBadge` | `components/common/VisualSystem.tsx` | No usar para fecha, moneda o documento. |
| Importe fuera de tabla | `AmountDisplay` | `components/common/VisualSystem.tsx` | Permitido fuera de celdas tabulares. |
| Acciones de fila | `RowActions` | `components/common/RowActions.tsx` | Una dominante, hasta dos visibles y overflow. |
| Estado de datos | `DataState` | `components/common` | Loading, empty, error y retry accionable. |

## Criterio de elección

Antes de crear un componente local, comprobar si el catálogo cubre anatomía y semántica. Un feature puede encapsular configuración de dominio —por ejemplo `DocumentStatusBadge` sobre `StatusBadge`—, pero no duplicar alturas, radios, colores funcionales ni comportamiento accesible.

Si falta una API, abrir una propuesta pequeña con consumidores reales. No agregar aliases de conveniencia ni wrappers de una sola pantalla.
