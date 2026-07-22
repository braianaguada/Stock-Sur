# Deprecaciones frontend

## APIs visuales retiradas

La consolidación final dejó estas APIs con cero consumidores y eliminó sus exports. No deben reintroducirse:

| API retirada | Reemplazo canónico | Estado |
|---|---|---|
| `FilterBar` | `FilterToolbar` | Retirada; cero consumidores. |
| `StatCard` | `MetricCard` dentro de `MetricGrid` | Retirada; cero consumidores. |
| `DataCard` | `Card` o superficie del arquetipo correspondiente | Retirada; cero consumidores. |
| `MetricHeroCard` | `MetricCard` con jerarquía definida por el arquetipo | Retirada; cero consumidores. |
| `SectionCard` | `Card` canónica | Retirada; cero consumidores. |
| `OperationalTableShell` | `DataTable` dentro de una superficie canónica | Retirada; cero consumidores. |
| `CompactBadge` | badge semántico específico de `VisualSystem` | Retirada; cero consumidores. |

También fueron retiradas las recetas CSS `.data-panel`, `.stat-tile` y `.stat-tile-featured`. La gobernanza estructural impide que los identificadores retirados vuelvan a aparecer en `src`.

## Uso prohibido

- `ui/Table` crudo en una lista operativa estándar;
- `ui/Badge` crudo para estados de dominio;
- clases `.surface-card`, `.filter-strip` o `.status-chip` importadas directamente desde rutas;
- variantes visuales locales que dupliquen `MetricGrid`, `FilterToolbar`, `DialogActionGrid`, `DataTable` o los badges semánticos.

Una excepción de tabla editable, impresión o flujo transaccional debe justificarse en el PR y conservar accesibilidad, responsive y semántica del sistema.
