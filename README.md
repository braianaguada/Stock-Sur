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
