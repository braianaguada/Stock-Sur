# Arquitectura frontend

Esta guía traduce la [Constitución UI](stock-sur-ui-constitution.md) a límites de implementación. La constitución define el resultado; este documento define dónde vive cada responsabilidad.

La [Constitucion tecnica](stock-sur-technical-constitution.md) es el contrato obligatorio para identidad efectiva, cache, multitenancy, acceso a datos, dependencias, testing y eliminacion de codigo muerto.

## Capas

1. `src/components/ui`: primitives de interacción y composición sin conocimiento de dominio.
2. `src/components/common`: presentación semántica transversal (métricas, celdas, badges y estados de datos).
3. `src/components/data-table`: infraestructura única para datasets operativos estándar.
4. `src/features/<dominio>`: columnas, adapters, formularios, hooks y semántica del dominio.
5. `src/pages`: composición de arquetipos, navegación y coordinación de estados; no redefine primitives.

Las dependencias avanzan de página a feature y de feature a componentes compartidos. Un componente compartido no importa una página ni una feature.

## Composición canónica

Toda ruta autenticada usa el viewport de `AppLayout` y compone su contenido con `PageContainer`. El arquetipo se elige antes de estilizar:

- Operational List: `PageHeader` → resumen opcional → `FilterToolbar` → una superficie con `DataTable` → paginación.
- Tabbed Workspace: `PageHeader` + `PageTabs` → toolbar estable → workspace.
- Analytical Dashboard: header/período → hasta cuatro métricas por fila → visualización → atención.
- Entity Detail, Transaction Flow y Administration siguen la anatomía definida en la constitución.

Las listas operativas no usan `ui/Table` directamente. Son excepciones válidas las matrices editables, impresión y flujos transaccionales; deben documentarse en el PR.

## Estado y datos

- La URL conserva navegación, entidad seleccionada y filtros compartibles cuando corresponda.
- React Query conserva estado remoto. Toda query dependiente de empresa incluye `companyId` en la key.
- El estado local queda limitado a interacción efímera: apertura de overlay, borradores y selección no navegable.
- Loading, empty, error y retry se expresan mediante un contrato estable; no se reemplaza toda la tabla por bloques con otra geometría.
- El rediseño visual no autoriza cambios simultáneos en queries, mutations, permisos o reglas de negocio.

- Actor, usuario efectivo e instancia de impersonacion forman el limite de identidad. Al cambiarlo se cancelan requests, se limpia todo el cache remoto y se descartan respuestas tardias.
- Un cambio de empresa conserva la identidad: cancela y elimina solamente las queries cuya key contiene la empresa anterior, y mantiene permisos vacios hasta validar la nueva.
- Las pages no agregan acceso directo a Supabase. La deuda existente se controla mediante una allowlist explicita con motivo y condicion de retiro.

## Excepciones

Una excepción debe indicar en el PR: ruta, primitive evitada, motivo de UX, alcance temporal y seguimiento. `className` no constituye una variante. Si el patrón se repite, se propone primero como primitive transversal y se actualizan catálogo, constitución y tests.

## Migración

Cada PR migra un arquetipo o familia acotada. Primero shell y composición; luego toolbar/resumen; después tablas y semántica; overlays al final. Los adapters deprecated se eliminan sólo cuando su búsqueda global llega a cero.
