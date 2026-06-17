# Stock Sur — Instrucciones para Codex

## Objetivo

Trabajá como lead engineer de Stock Sur.

Stock Sur es una aplicación multitenant de gestión comercial desarrollada con:

* React
* Vite
* TypeScript
* Supabase
* PostgreSQL
* React Query
* Tailwind
* shadcn/ui
* Vitest

Priorizá:

1. integridad de datos;
2. aislamiento por empresa;
3. seguridad;
4. compatibilidad con flujos existentes;
5. cambios pequeños y revisables;
6. experiencia operativa clara.

## Flujo Git obligatorio

Antes de modificar código:

```bash
git fetch origin --prune
```

Crear siempre una rama nueva desde `origin/staging`:

```bash
git checkout -b <tipo>/<nombre-corto> origin/staging
```

Reglas:

* no trabajar directamente sobre `main`;
* no trabajar directamente sobre `staging`;
* no crear ramas desde una rama antigua;
* no hacer merge local hacia `staging`;
* no usar `main` como base para trabajo normal;
* un objetivo funcional por rama;
* reutilizar la rama y el PR existentes cuando se trate de QA o correcciones del mismo cambio.

Todo cambio debe finalizar con:

* commit;
* push;
* Pull Request hacia `staging`.

`main` se usa únicamente para promociones aprobadas desde `staging`.

## Alcance y exploración

Antes de modificar:

1. inspeccioná los archivos directamente relacionados;
2. identificá dependencias reales;
3. expandí la búsqueda solo si es necesario.

No recorras todo el repositorio de forma indiscriminada.

No audites módulos no relacionados salvo que exista riesgo directo de regresión.

No implementes funcionalidades fuera del alcance solicitado.

Cuando el requerimiento sea claro, inspeccioná lo mínimo necesario e implementá. No generes una auditoría previa extensa salvo que sea solicitada o exista una decisión arquitectónica abierta.

## Base de datos y Supabase

Toda modificación de esquema debe:

* crear una migración nueva en `supabase/migrations`;
* conservar migraciones anteriores sin editarlas;
* ser compatible con el estado actual de staging;
* incluir RLS, permisos y aislamiento por `company_id` cuando corresponda;
* evitar operaciones parciales;
* ser atómica siempre que sea razonable.

Aplicar migraciones únicamente en staging con:

```bash
npm run db:push:staging
```

Nunca ejecutar:

```bash
npm run db:push:prod
```

No tocar producción.

No usar datos productivos reales para pruebas destructivas.

Las pruebas temporales en staging deben:

* utilizar datos de prueba;
* revertirse o limpiarse;
* no emitir comprobantes reales;
* no dejar movimientos contables, stock o cuenta corriente residuales.

## Multitenancy

Todo registro perteneciente a una empresa debe tener y respetar `company_id`.

No confiar únicamente en filtros del frontend.

Validar aislamiento en:

* consultas;
* mutations;
* RPC;
* triggers;
* funciones `SECURITY DEFINER`;
* RLS;
* Storage;
* query keys;
* caché;
* previews;
* impresión.

Un usuario normal solo puede operar empresas:

* activas;
* con membresía activa;
* para las que tenga permisos efectivos.

Una empresa inactiva no puede utilizarse como contexto operativo.

## Seguridad

Nunca:

* guardar credenciales;
* imprimir contraseñas;
* persistir cookies;
* guardar tokens o sesiones;
* incluir secretos en commits;
* incluir secretos en logs;
* modificar archivos `.env` con valores reales;
* exponer service-role keys.

Las credenciales de QA solo pueden utilizarse de forma interactiva.

No reducir RLS, validaciones o permisos para facilitar una prueba.

No desactivar seguridad globalmente.

## Compatibilidad funcional

Antes de cambiar lógica relacionada con documentos, caja, stock o cuenta corriente, revisar posibles efectos sobre:

* `PRESUPUESTO`;
* `REMITO`;
* `REMITO_DEVOLUCION`;
* emisión;
* duplicado;
* stock `IN` y `OUT`;
* caja;
* cuenta corriente;
* trabajos y servicios;
* facturación;
* impresión;
* multitenancy.

No crear movimientos de stock, caja, cuenta corriente o facturación salvo que el requerimiento lo indique explícitamente.

## Frontend y React Query

Toda query dependiente de empresa debe incluir `companyId` en su query key.

No conservar datos de una empresa al cambiar a otra.

Evitar:

* estados duplicados;
* efectos innecesarios;
* invalidaciones globales sin justificación;
* formularios con valores antiguos;
* errores genéricos cuando puede mostrarse un error específico;
* pérdida silenciosa de datos cargados.

Las operaciones críticas deben mostrar:

* estado de carga;
* éxito;
* error específico;
* confirmación cuando corresponda.

Mantener compatibilidad responsive y evitar overflow horizontal.

## Implementación

Preferir:

* funciones pequeñas;
* helpers puros;
* tipos explícitos;
* validación centralizada;
* reutilización de patrones existentes;
* cambios focalizados;
* nombres claros;
* mensajes de error accionables.

Evitar:

* duplicar lógica;
* agregar abstracciones sin uso inmediato;
* reescribir archivos completos sin necesidad;
* refactors amplios dentro de una funcionalidad pequeña;
* dependencias nuevas sin justificación;
* soluciones específicas para una única empresa cuando la función debe ser genérica.

## Tests

Durante el desarrollo, ejecutar primero tests focalizados.

Antes del commit o PR ejecutar siempre:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
git diff --check
```

Agregar tests de regresión para todo defecto real corregido.

Si tests DB no pueden ejecutarse por falta de credenciales:

* no inventar resultados;
* indicar cuáles quedaron omitidos;
* ejecutar tests estáticos disponibles;
* dejar instrucciones exactas para validarlos en staging.

No afirmar que una validación fue completada si no se ejecutó.

## QA

Cuando se solicite QA sobre un PR existente:

* continuar en la misma rama;
* actualizar el mismo PR;
* no crear otra rama;
* no crear otro PR;
* corregir únicamente defectos reales del alcance;
* agregar test de regresión si se modifica código.

Separar claramente:

* QA automatizada;
* QA DB;
* QA visual;
* QA pendiente.

No emitir documentos reales durante QA salvo autorización explícita.

## README

Después de implementar cambios, actualizar brevemente `README.md`.

Actualizar solo lo relacionado con la rama:

* estado actual de staging;
* resumen funcional;
* migraciones;
* validaciones;
* notas de uso;
* limitaciones;
* deuda técnica relevante.

No reescribir todo el README.

## Pull Request

El PR debe apuntar a `staging`.

Incluir:

* qué cambió;
* por qué;
* rama base;
* migraciones;
* validaciones;
* QA;
* riesgos;
* pendientes;
* confirmación de que no se tocó producción.

Mantener historial lineal cuando sea posible.

No promover a `main` salvo solicitud explícita.

## Comunicación

No narrar paso a paso toda la exploración.

Mantener las respuestas concisas.

Informar únicamente:

* decisiones relevantes;
* cambios realizados;
* archivos importantes;
* migraciones;
* validaciones;
* bloqueos;
* riesgos;
* estado del PR.

No repetir el requerimiento completo en la entrega final.

No afirmar éxito sin evidencia.

## Entrega final estándar

Al finalizar informar:

* rama;
* commit;
* enlace del PR;
* resumen técnico;
* archivos principales;
* migraciones;
* tests;
* QA;
* README actualizado;
* riesgos o pendientes;
* dictamen `APTO` o `NO APTO`.
