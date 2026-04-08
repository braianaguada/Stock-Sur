# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Security hardening (PR1)

### Required environment variables
Create a local `.env` file (not committed) based on `.env.example`:

```sh
cp .env.example .env
```

Then complete:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

> `.env` is ignored by git and must not be committed. Use `.env.example` as template.

If either variable is missing, the app renders a clear **"Configurar .env"** screen instead of failing with a blank page.

### Roles and admin promotion
New users are now created with role `user` by default.

To promote a specific user to admin, run this SQL in Supabase SQL Editor:

```sql
insert into public.user_roles (user_id, role)
values ('<USER_UUID>', 'admin')
on conflict (user_id, role) do nothing;
```

To revoke admin:

```sql
delete from public.user_roles
where user_id = '<USER_UUID>'
  and role = 'admin';
```

### RLS model used
For operational tables (`items`, `item_aliases`, `stock_movements`, `suppliers`, `price_lists`, `price_list_versions`, `price_list_lines`, `customers`, `quotes`, `quote_lines`):

- **Read**: any authenticated user (keeps current UX and cross-module listings).
- **Write**: only record owner (`created_by = auth.uid()`) or `admin`.

This preserves current functionality for each creator while removing previous permissive `USING (true)` write access.

## Importación de listas (CSV + XLSX)

Flujo rápido:

1. Ir a **Importaciones** y elegir la lista de precios.
2. Subir archivo `.csv` o `.xlsx` (se usa la primera hoja para XLSX).
3. Mapear columnas obligatorias: **Descripción** y **Precio**. **Código proveedor** es opcional.
4. Revisar preview: se muestran solo filas válidas (filas vacías se descartan automáticamente).
5. Confirmar importación.

Notas:

- El parser tolera precios con `,` o `.` como separador decimal, símbolos de moneda y espacios.
- Si el archivo no se puede leer, se informa un error claro en pantalla y en consola.

## Importación asistida con IA para PDFs difíciles

Se agregó una capa opcional para PDFs de proveedores con muchas imágenes o texto poco legible:

- El flujo sigue intentando primero con `pdfjs` y OCR local.
- Si el resultado es flojo, prueba automáticamente una Edge Function de Supabase con Gemini.
- Si Gemini no está configurado o falla, el sistema vuelve al parser actual sin cortar la importación.

### Configuración

1. Crear los secretos en Supabase:

```sh
supabase secrets set GEMINI_API_KEY=tu_api_key
supabase secrets set GEMINI_MODEL=gemini-2.5-flash
```

2. Desplegar la función:

```sh
supabase functions deploy supplier-pdf-ai-extract
```

3. Verificar que la sesión del usuario autenticado pueda invocar Edge Functions normalmente.

### Qué devuelve Gemini

La función intenta devolver una estructura limpia con:

- `supplier_code`
- `description`
- `price`
- `currency`

Luego el frontend reutiliza el mismo modal de mapeo PDF y el mismo pipeline de importación que ya existía.

## Migración definitiva (Supabase CLI, sin dashboard)

Se agregó la migración:

- `supabase/migrations/20260226090000_fix_schema_cache_price_list_items_and_supplier_nullable.sql`

Incluye:

- `suppliers.whatsapp` (nullable) + backfill opcional desde `phone`/`telefono` si existen.
- `price_lists.supplier_id` nullable + FK con `ON DELETE SET NULL`.
- creación idempotente de `public.price_list_items` + índices + RLS owner/admin.
- `NOTIFY pgrst, 'reload schema';` al final para recargar schema cache de PostgREST.

### Aplicar desde el proyecto

```sh
supabase db push
```

> Alternativa (según versión/flujo de tu CLI):

```sh
supabase migration up
```

### Verificación rápida por SQL

```sql
-- 1) columna suppliers.whatsapp existe
select column_name, is_nullable, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'suppliers'
  and column_name = 'whatsapp';

-- 2) tabla public.price_list_items existe
select to_regclass('public.price_list_items') as price_list_items_table;

-- 3) price_lists.supplier_id ya no es NOT NULL
select column_name, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'price_lists'
  and column_name = 'supplier_id';
```

## Database migrations

Migrations are stored in:

`supabase/migrations`

Step 1 - deploy to staging:

```sh
npm run db:push:staging
```

Step 2 - verify staging.

Step 3 - deploy to production:

```sh
npm run db:push:prod
```

## Git workflow

This repository uses a simple linear flow to avoid branch drift:

- `main`: production only
- `staging`: demo / QA / pre-production
- `feat/*`, `fix/*`, `chore/*`: short-lived work branches created from `staging`

### Daily flow

1. Update `staging`

```sh
git checkout staging
git pull origin staging
```

2. Create a short-lived branch from `staging`

```sh
git checkout -b feat/my-change
```

3. Work normally, commit, and push the branch

```sh
git push -u origin feat/my-change
```

4. Open a PR to `staging`

- Prefer `Squash and merge` or `Rebase and merge`
- Do not use merge commits

5. After QA/demo approval, open a PR from `staging` to `main`

- Keep the promotion linear
- Do not merge `main` into `staging` manually

### Rules

- Do not work directly on `main`
- Do not keep a permanent `dev` branch unless the team explicitly restores that model
- Do not create sync branches like `sync/main-into-staging`
- If production needs a hotfix, apply it through a short-lived branch and then bring it back to `staging` with a clean PR
- After each promotion, update both local branches:

```sh
git checkout main
git pull origin main
git checkout staging
git pull origin staging
```

### Why this flow

`main` and `staging` may sometimes have different commit hashes even when the file content is the same. That is acceptable. The goal is to keep promotions predictable and the history linear so future PRs and merges stay clean.
