# Diseño: impersonación segura para `superadmin`

## Objetivo

Permitir que un usuario con rol `superadmin` opere temporalmente con la identidad efectiva de otro usuario para reproducir problemas, validar permisos y revisar UX real, sin pedir la contraseña del usuario destino.

## Restricción clave del stack actual

La app es una SPA en React usando Supabase Auth + RLS.

Eso implica:

- No alcanza con cambiar estado local en frontend.
- No alcanza con seleccionar "ver como usuario".
- Mientras el JWT siga siendo el del `superadmin`, `auth.uid()` seguirá devolviendo el `superadmin`.
- Por lo tanto, cualquier impersonación real necesita backend server-side.

Si se implementa solo en React, la UI puede parecer la de otro usuario, pero la base seguiría autorizando como `superadmin`. Eso rompe el objetivo y genera riesgo de seguridad.

## Enfoque recomendado

Implementar impersonación real mediante una Edge Function que:

1. valide que el actor autenticado sea `superadmin`,
2. cree una sesión de impersonación auditada,
3. emita un token temporal firmado para el usuario destino,
4. permita restaurar la sesión original del `superadmin`.

## Resultado esperado

Durante la impersonación:

- `auth.uid()` debe ser el `user_id` impersonado,
- las policies RLS deben evaluarse con ese usuario,
- la UI debe mostrar claramente que la sesión es impersonada,
- toda operación sensible debe quedar auditada con actor real y actor efectivo.

## Arquitectura

### 1. Sesión original del superadmin

Al iniciar impersonación, el frontend guarda en `sessionStorage`:

- `originalAccessToken`
- `originalRefreshToken`
- `originalUserId`
- `originalEmail`
- `impersonationStartedAt`

Esto permite volver a la sesión original sin volver a loguearse.

### 2. Sesión efectiva del usuario impersonado

La Edge Function responde con:

- `access_token`
- `refresh_token`
- `expires_at`
- `impersonation_id`
- `target_user`

El frontend ejecuta `supabase.auth.setSession(...)` con ese par de tokens.

### 3. Auditoría persistente

Crear tabla dedicada:

`public.impersonation_sessions`

Campos sugeridos:

- `id uuid primary key default gen_random_uuid()`
- `actor_user_id uuid not null references auth.users(id)`
- `target_user_id uuid not null references auth.users(id)`
- `reason text null`
- `started_at timestamptz not null default now()`
- `ended_at timestamptz null`
- `ended_by_user_id uuid null references auth.users(id)`
- `status text not null default 'ACTIVE'`
- `metadata jsonb not null default '{}'::jsonb`

Reglas:

- solo `superadmin` puede insertar,
- solo `superadmin` puede cerrar,
- lectura restringida a `superadmin`,
- no permitir `actor_user_id = target_user_id`.

## Backend

### Edge Function `impersonation-start`

Entrada:

```json
{
  "targetUserId": "uuid",
  "reason": "texto opcional"
}
```

Validaciones:

- request autenticada,
- `auth.uid()` presente,
- actor con `public.is_superadmin(auth.uid()) = true`,
- usuario destino existente,
- usuario destino distinto del actor,
- opcional: bloquear impersonar a otro `superadmin`.

Pasos:

1. crear registro en `public.impersonation_sessions`,
2. generar sesión del usuario destino usando credenciales server-side,
3. devolver tokens temporales y metadata.

### Edge Function `impersonation-stop`

Entrada:

```json
{
  "impersonationId": "uuid"
}
```

Pasos:

1. validar request autenticada,
2. cerrar la sesión en `public.impersonation_sessions`,
3. no hace falta emitir tokens nuevos si el frontend ya conservó la sesión original.

## Cómo emitir la sesión del usuario destino

Este es el punto más delicado.

Opciones:

### Opción A. Impersonación nativa si tu backend ya soporta mint de JWT para Supabase

Es la mejor opción, pero depende de infraestructura adicional fuera de esta SPA.

### Opción B. Crear `custom access token` firmado con el JWT secret del proyecto

Viable si controlás el backend/Edge Function y configurás bien:

- `sub = target_user_id`
- `role = authenticated`
- claims mínimas esperadas por Supabase Auth/RLS
- expiración corta, por ejemplo 10 minutos
- claims extra:
  - `impersonated_by`
  - `impersonation_id`
  - `is_impersonation = true`

### Opción C. "Login as user" vía Admin API sin contraseña

No es recomendable si termina derivando en generar links mágicos reutilizables o flujos opacos. Sirve menos para control fino y restauración limpia.

Para este proyecto, la opción más clara es B si tenés control sobre secrets de Supabase en la función.

En Edge Functions conviene usar un secret propio como `JWT_SECRET`, no uno con prefijo `SUPABASE_`.

## Claims recomendadas

Agregar claims al token impersonado:

```json
{
  "sub": "<target_user_id>",
  "role": "authenticated",
  "email": "<target_email>",
  "is_impersonation": true,
  "impersonated_by": "<superadmin_user_id>",
  "impersonation_id": "<impersonation_session_id>"
}
```

Esto habilita auditoría y comportamiento diferenciado en frontend y SQL.

## Base de datos

### Nueva tabla

Agregar migration para `public.impersonation_sessions`.

### Funciones SQL auxiliares

Sugeridas:

- `public.is_impersonating() returns boolean`
- `public.impersonation_actor_id() returns uuid`
- `public.current_effective_user_id() returns uuid`

Implementación esperada:

- si el JWT no tiene claims de impersonación, `current_effective_user_id()` devuelve `auth.uid()`,
- si sí tiene claims, `auth.uid()` sigue siendo el usuario efectivo impersonado,
- `impersonation_actor_id()` devuelve el `superadmin` real desde el claim.

### Auditoría en tablas críticas

Hoy varias tablas ya guardan `created_by`, `updated_by`, `changed_by`.

Para trazabilidad real conviene extender operaciones críticas para almacenar además:

- `actor_user_id` real,
- `effective_user_id`,
- `impersonation_id` si aplica.

Esto importa especialmente en:

- documentos,
- caja,
- precios,
- cambios de stock,
- configuración,
- asignación de permisos.

## Frontend

## Cambios en `src/contexts/AuthContext.tsx`

Agregar al contexto:

- `isImpersonating: boolean`
- `impersonationActorId: string | null`
- `impersonationTargetId: string | null`
- `impersonationId: string | null`
- `startImpersonation: (targetUserId: string, reason?: string) => Promise<void>`
- `stopImpersonation: () => Promise<void>`

Comportamiento:

- detectar claims de impersonación leyendo `session.access_token`,
- mantener `original session` en `sessionStorage`,
- restaurar sesión original al cortar impersonación,
- limpiar storage si la restauración falla.

## Cambios en `src/features/users`

En la tabla de usuarios:

- agregar acción `Impersonar`,
- visible solo si el viewer es `superadmin`,
- deshabilitada para el mismo usuario,
- opcionalmente deshabilitada para otros `superadmin`.

UX recomendada:

- confirmar con modal,
- pedir motivo opcional,
- mostrar email del usuario destino,
- advertir que todas las acciones quedarán auditadas.

## Cambios en `src/components/AppSidebar.tsx`

Mostrar banner persistente cuando `isImpersonating = true`:

- texto: `Estás operando como <email>`
- texto secundario: `Actor real: <email superadmin>`
- CTA principal: `Volver a mi sesión`

Ese banner no debe poder ocultarse.

## Cambios en navegación

Mientras la sesión sea impersonada:

- mantener las pantallas según permisos reales del usuario impersonado,
- opcionalmente bloquear acceso a `/users` y `/settings` global si el usuario destino no puede verlas,
- mantener siempre visible el CTA para terminar impersonación.

## Reglas de seguridad

- solo `superadmin` puede iniciar impersonación,
- no permitir impersonar al propio usuario,
- recomendable no permitir impersonar otros `superadmin`,
- expiración corta del token impersonado,
- una sola impersonación activa por browser tab,
- registrar inicio y fin,
- si el token vence, restaurar sesión original o forzar logout controlado.

## Riesgos a evitar

### 1. Pseudo-impersonación en frontend

Incorrecta porque RLS seguiría viendo al `superadmin`.

### 2. No guardar actor real

Incorrecto porque perdés trazabilidad en acciones críticas.

### 3. Reutilizar tokens largos

Incorrecto porque aumenta el impacto ante filtración.

### 4. No marcar visualmente la sesión impersonada

Incorrecto porque el operador puede ejecutar acciones creyendo que está en su sesión normal.

## Plan de implementación sugerido

### Fase 1. Backend mínimo viable

1. migration con tabla `impersonation_sessions`
2. Edge Function `impersonation-start`
3. Edge Function `impersonation-stop`
4. claims de impersonación en JWT temporal

### Fase 2. Frontend base

1. extender `AuthContext`
2. agregar banner global
3. agregar botón `Impersonar` en `UsersAccessTable`
4. restauración de sesión original

### Fase 3. Auditoría fuerte

1. propagar `impersonation_id` a RPCs críticas
2. guardar actor real en logs/eventos
3. revisar tablas con `created_by` o `updated_by`

## Encaje con este repo

Puntos concretos donde tocaría:

- `src/contexts/AuthContext.tsx`
- `src/features/users/components/UsersAccessTable.tsx`
- `src/pages/Users.tsx`
- `src/components/AppSidebar.tsx`
- `supabase/migrations/*_impersonation_sessions.sql`
- `supabase/functions/impersonation-start/index.ts`
- `supabase/functions/impersonation-stop/index.ts`

## Recomendación final

Para este proyecto, la implementación correcta es:

- backend con Edge Function,
- token temporal del usuario destino,
- auditoría en tabla propia,
- banner global y restauración de sesión original.

No recomiendo avanzar con una versión solo cliente porque daría una falsa sensación de permisos reales y dejaría inconsistencias con RLS.
