# Deprecaciones frontend

Las APIs de esta lista siguen disponibles sólo para migración. No aceptan consumidores nuevos.

| API | Reemplazo | Estado de retiro |
|---|---|---|
| `FilterBar` | `FilterToolbar` | Retirar al llegar a cero imports. |
| `StatCard` | `MetricCard` / resumen canónico | Retirar al llegar a cero imports. |
| `DataCard` | superficie workspace canónica | Retirar al llegar a cero imports. |
| `MetricHeroCard` | `MetricCard` con jerarquía del arquetipo | Retirar al llegar a cero imports. |
| `SectionCard` | superficie/card canónica | Retirar al llegar a cero imports. |
| `OperationalTableShell` | `DataTable` en superficie canónica | Retirar al llegar a cero imports. |
| `CompactBadge` | badge semántico específico | Retirar al llegar a cero imports. |

También quedan prohibidos para consumidores nuevos:

- `ui/Table` crudo en una lista operativa estándar;
- `ui/Badge` crudo para estados de dominio;
- `.surface-card`, `.filter-strip`, `.data-panel`, `.stat-tile` y `.status-chip` desde rutas.

## Política

El test estructural mantiene una allowlist de consumidores históricos. Una migración elimina rutas de esa lista; nunca agrega entradas salvo una excepción de UX aprobada y documentada en el PR. No se elimina un adapter mientras existan imports activos.

Para retirar una API: buscar imports globales, migrar consumidores, ejecutar validaciones, eliminar export y tests de compatibilidad, y actualizar este documento y el catálogo en el mismo PR.
