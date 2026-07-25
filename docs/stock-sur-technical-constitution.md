# Constitucion tecnica de Stock Sur

Este documento fija las reglas de arquitectura y mantenimiento para todo codigo nuevo o modificado. Complementa `AGENTS.md`, la arquitectura frontend y la constitucion visual. Ante un conflicto prevalecen, en este orden, integridad de datos, aislamiento multitenant, seguridad y compatibilidad funcional.

## 1. Limites y direccion de dependencias

La estructura objetivo es:

1. `src/pages`: compone rutas, navegacion y casos de uso. No contiene acceso nuevo directo a Supabase ni primitives locales.
2. `src/features/<dominio>`: concentra UI, hooks, validaciones y adaptadores propios del dominio.
3. `src/hooks`: coordina estado remoto o transversal reutilizable; no presenta UI.
4. `src/services` o gateways de feature: ejecutan operaciones remotas y traducen errores de infraestructura.
5. `src/components/common` y `src/components/data-table`: contratos visuales transversales sin reglas de un dominio particular.
6. `src/components/ui`: primitives sin conocimiento de negocio.
7. `src/lib`: funciones puras, politicas y tipos transversales.
8. `src/integrations`: clientes de infraestructura generados o de bajo nivel.

Las dependencias avanzan desde las capas de composicion hacia las capas de dominio e infraestructura. Una capa compartida no importa pages ni features. Los tipos compartidos viven en modulos neutrales: nunca se importan desde un provider para ser usados por una dependencia del mismo provider.

Una abstraccion se incorpora cuando tiene un consumidor inmediato, reduce una duplicacion real o protege una invariante. No se crean stores, buses de eventos, frameworks internos ni capas genericas por anticipacion.

## 2. Responsabilidades por unidad

- Una page decide que se muestra y coordina rutas; delega consultas, mutations, formatos y reglas.
- Un componente presenta una responsabilidad reconocible. No abre conexiones, decide permisos ni replica reglas del backend.
- Un hook coordina ciclo de vida y devuelve un contrato tipado y estable. No oculta efectos globales inesperados.
- Un service o gateway recibe entradas explicitas, incluido `companyId` cuando corresponde, y no lee contexto visual.
- Un adapter transforma datos entre contratos; no ejecuta I/O.
- Un helper es puro, pequeno y nombrado por su intencion.

Funciones y componentes se separan por responsabilidad, no por un limite arbitrario de lineas. Son senales de division: ramas de negocio independientes, multiples efectos, varios niveles de abstraccion, demasiadas dependencias o tests que requieren preparar estados no relacionados.

## 3. Identidad efectiva y React Query

La identidad efectiva incluye al actor autenticado, al usuario efectivo y, cuando existe, la instancia de impersonacion. Cambiar cualquiera de esos valores es un limite de seguridad.

Antes de abandonar una identidad se debe:

1. marcar la UI autenticada como loading seguro y vaciar permisos, roles, empresas y contexto visibles;
2. invalidar generaciones de cargas de autenticacion y permisos;
3. cancelar todas las queries pendientes;
4. limpiar completamente el cache de React Query;
5. ignorar toda respuesta tardia de la identidad anterior.

Este contrato aplica al logout, login de otro usuario, inicio y fin de impersonacion y restauracion de sesion. La limpieza debe ser idempotente para que renders o eventos repetidos no creen ciclos.

Un cambio ordinario de empresa no equivale a un cambio de identidad: cancela y elimina solamente queries cuya key contiene la empresa anterior. No elimina datos publicos ni el cache valido de otras empresas. Durante la transicion, los permisos de la empresa anterior se vacian antes de solicitar los nuevos.

Toda query, mutation e invalidacion dependiente de empresa:

- recibe un `companyId` explicito;
- incluye ese mismo valor en la query key;
- usa factories canonicas de `queryKeys`;
- se deshabilita cuando falta identidad o empresa valida;
- invalida solamente las keys del dominio y empresa afectados.

Nunca se usa una key global para datos multitenant. La cache del frontend no reemplaza RLS ni los filtros del backend.

## 4. Acceso a datos y multitenancy

Las pages no agregan imports directos del cliente Supabase. La allowlist temporal en `architecture/allowlists/pages-direct-supabase.json` registra deuda existente con motivo y condicion de retiro; no es una autorizacion para ampliarla.

El acceso nuevo pasa por un hook y un service/gateway de dominio. Cada operacion valida:

- identidad y membresia efectiva;
- empresa activa;
- `company_id` en filtros, escrituras, RPC, Storage y cache;
- permisos efectivos;
- errores especificos y accionables.

RLS es obligatoria para datos de empresa. Las funciones `SECURITY DEFINER` fijan `search_path`, validan actor, membresia y empresa, y exponen solo el permiso minimo. Ningun cambio frontend justifica reducir seguridad.

## 5. Estado, errores y feedback

El estado remoto vive en React Query; la URL conserva navegacion y filtros compartibles; el estado local se limita a interaccion efimera y borradores. No se duplican datos remotos en contextos o stores.

Cada operacion asincrona ofrece loading, exito, error especifico y retry seguro cuando corresponda. Las acciones criticas son idempotentes o bloquean dobles envios. Los errores tecnicos se traducen sin ocultar informacion util ni exponer secretos. Un error no puede dejar permisos, datos o controles pertenecientes a una identidad anterior.

## 6. Codigo muerto y deprecaciones

Codigo, exports, archivos, estilos y dependencias sin consumidores se eliminan cuando existe evidencia:

1. busqueda de referencias y exports;
2. analisis estatico con las allowlists justificadas;
3. tests focalizados y suite completa;
4. typecheck y build correctos.

No se conserva codigo "por si acaso", pero tampoco se elimina por intuicion, coincidencia de nombres o cobertura incompleta. Un reemplazo deprecated se retira solo cuando la busqueda global llega a cero. Las excepciones deben indicar responsable, motivo y condicion verificable de eliminacion.

## 7. Testing y guardrails

Todo defecto real incorpora una regresion en el nivel mas cercano:

- unitario para funciones puras, factories y politicas;
- componente/hook para estados y coordinacion;
- integracion para limites entre autenticacion, cache y datos;
- DB para RLS, RPC, triggers e invariantes, siempre en staging y con rollback;
- E2E para flujos criticos sin generar operaciones reales durante QA.

Los tests no afirman comportamiento mediante snapshots opacos cuando puede probarse la invariante. Todo PR ejecuta typecheck, lint, tests, build y `git diff --check`.

Guardrails obligatorios:

- Madge usa `tsconfig.app.json`, resuelve aliases y mantiene cero ciclos.
- Knip incluye las entradas frontend, tests y funciones serverless. Excluye tipos publicos y el archivo generado de Supabase; sus demas excepciones se limitan a binarios ejecutados desde scripts y deben revisarse al cambiar el tooling.
- Las pages no amplian el acceso directo a Supabase.
- Las query keys multitenant incluyen `companyId`.
- No se habilita strict global como efecto lateral de un refactor; su adopcion sera gradual y focalizada.

## 8. Dependencias y performance

Una dependencia nueva requiere necesidad concreta, evaluacion de mantenimiento, seguridad, tamano y una alternativa descartada. Se prefieren APIs de plataforma y dependencias existentes.

Se mide antes de optimizar. Se revisan especialmente:

- waterfalls y consultas duplicadas;
- invalidaciones globales;
- payloads y selects sobredimensionados;
- renders causados por estado duplicado;
- modulos pesados en el bundle inicial;
- listas sin paginacion o virtualizacion cuando el volumen lo exige.

Memoizacion, lazy loading y cache adicional se aplican con evidencia y tests; no se usan como decoracion.

## 9. Checklist para futuros PR

- Rama nueva desde `origin/staging`; un objetivo y un PR hacia staging.
- Alcance y capas afectadas identificados; sin cambios oportunistas.
- `companyId`, RLS, permisos, query keys e invalidaciones revisados.
- Sin imports nuevos de pages a Supabase, ciclos ni dependencias inversas.
- Sin duplicacion evitable, codigo muerto nuevo o deprecated imports.
- Errores, loading, empty, exito y dobles envios cubiertos.
- Regresiones focalizadas agregadas y suite obligatoria ejecutada.
- Migraciones nuevas, atomicas y solo en staging cuando corresponda.
- README y documentacion arquitectonica actualizados de forma focalizada.
- Riesgos, excepciones, QA pendiente y confirmacion de no tocar produccion documentados.

Toda excepcion debe quedar explicita en el PR con alcance, razon, riesgo, responsable y condicion de retiro. Una excepcion silenciosa es un defecto.
