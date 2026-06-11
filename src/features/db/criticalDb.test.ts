import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";

const DEFAULT_DB_HOST = "db.tihjnbfdjnjobxxecuaz.supabase.co";
const DB_PASSWORD = process.env.PGPASSWORD ?? "";
const DB_HOST = process.env.PGHOST ?? DEFAULT_DB_HOST;
const DB_PORT = Number(process.env.PGPORT ?? 5432);
const DB_USER = process.env.PGUSER ?? "postgres";
const DB_NAME = process.env.PGDATABASE ?? "postgres";
const DATABASE_URL = process.env.DATABASE_URL;

const describeCriticalDb = DB_PASSWORD ? describe : describe.skip;

let client: import("pg").Client;

async function withRollback<T>(fn: () => Promise<T>): Promise<T> {
  await client.query("begin");
  try {
    const result = await fn();
    await client.query("rollback");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function setActor(userId: string) {
  await client.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await client.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: userId, role: "authenticated" })]);
}

async function expectDbRejection(query: string, params: unknown[] = []) {
  await client.query("savepoint expected_db_rejection");
  let rejection: unknown;
  try {
    await client.query(query, params);
  } catch (error) {
    rejection = error;
  }
  await client.query("rollback to savepoint expected_db_rejection");
  expect(rejection).toBeTruthy();
}

async function seedUser(userId: string) {
  await client.query(
    `
    insert into auth.users (id, email, aud, role, is_sso_user, is_anonymous, email_confirmed_at, created_at, updated_at)
    values ($1, $2, 'authenticated', 'authenticated', false, false, now(), now(), now())
    on conflict (id) do nothing
    `,
    [userId, `${userId}@test.local`],
  );
}

async function seedCompany(companyId: string) {
  await client.query(
    `
    insert into public.companies (id, name, slug, status, created_at, updated_at)
    values ($1, 'DB Test Co', $2, 'ACTIVE', now(), now())
    on conflict (id) do nothing
    `,
    [companyId, `db-test-${companyId.slice(0, 8)}`],
  );
}

async function seedPermission(companyUserId: string, code: string) {
  const existing = await client.query(`select id from public.permissions where code = $1 limit 1`, [code]);
  const permissionId = existing.rows[0]?.id ?? crypto.randomUUID();
  if (!existing.rows[0]) {
    await client.query(
      `
      insert into public.permissions (id, code, module, action, description)
      values ($1, $2, split_part($2, '.', 1), split_part($2, '.', 2), $2)
      `,
      [permissionId, code],
    );
  }
  await client.query(
    `
    insert into public.company_user_permissions (id, company_user_id, permission_id, effect, created_at)
    values ($1, $2, $3, 'ALLOW', now())
    on conflict do nothing
    `,
    [crypto.randomUUID(), companyUserId, permissionId],
  );
}

async function seedActor(companyId: string, userId: string) {
  const companyUserId = crypto.randomUUID();
  await client.query(
    `
    insert into public.company_users (id, company_id, user_id, status, created_at, updated_at)
    values ($1, $2, $3, 'ACTIVE', now(), now())
    on conflict (company_id, user_id) do nothing
    `,
    [companyUserId, companyId, userId],
  );
  return companyUserId;
}

async function seedItem(companyId: string, userId: string) {
  const itemId = crypto.randomUUID();
  await client.query(
    `
    insert into public.items (id, sku, name, unit, is_active, created_at, updated_at, demand_profile, company_id)
    values ($1, $2, 'Item DB Test', 'UN', true, now(), now(), 'LOW', $3)
    `,
    [itemId, `SKU-${itemId.slice(0, 8)}`, companyId],
  );
  return itemId;
}

async function seedCustomer(companyId: string, name: string, isOccasional = false) {
  const customerId = crypto.randomUUID();
  await client.query(
    `
    insert into public.customers (id, company_id, name, cuit, is_occasional, created_at, updated_at)
    values ($1, $2, $3, null, $4, now(), now())
    `,
    [customerId, companyId, name, isOccasional],
  );
  return customerId;
}

describeCriticalDb("critical database rules", () => {
  beforeAll(async () => {
    const { Client } = await new Function('return import("pg")')();
    client = DATABASE_URL
      ? new Client({
          connectionString: DATABASE_URL,
          ssl: { rejectUnauthorized: false },
        })
      : new Client({
          host: DB_HOST,
          port: DB_PORT,
          user: DB_USER,
          password: DB_PASSWORD,
          database: DB_NAME,
          ssl: { rejectUnauthorized: false },
        });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it("mantiene RLS habilitado en todas las tablas con company_id", async () => {
    const result = await client.query(
      `
      select c.relname as table_name
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      join information_schema.columns col
        on col.table_schema = n.nspname
       and col.table_name = c.relname
       and col.column_name = 'company_id'
      where n.nspname = 'public'
        and c.relkind in ('r', 'p')
        and not c.relrowsecurity
      order by c.relname
      `,
    );

    expect(result.rows.map((row) => row.table_name)).toEqual([]);
  });

  it("asigna membresia admin al superadmin que crea una empresa", async () => {
    await withRollback(async () => {
      const userId = crypto.randomUUID();
      const slug = `db-create-company-${userId.slice(0, 8)}`;
      await seedUser(userId);
      await client.query(
        `
        insert into public.user_roles (user_id, role)
        values ($1, 'superadmin')
        on conflict do nothing
        `,
        [userId],
      );

      await setActor(userId);
      await client.query("set local role authenticated");

      const created = await client.query(
        `select id from public.create_company($1, $2)`,
        ["DB Created Company", slug],
      );
      const companyId = created.rows[0].id;
      const access = await client.query(
        `
        select cu.status, r.code
        from public.company_users cu
        join public.company_user_roles cur on cur.company_user_id = cu.id
        join public.roles r on r.id = cur.role_id
        where cu.company_id = $1
          and cu.user_id = $2
        `,
        [companyId, userId],
      );

      expect(access.rows).toEqual([{ status: "ACTIVE", code: "admin" }]);
    });
  });

  it("aísla lecturas, escrituras y RPC entre empresas", async () => {
    await withRollback(async () => {
      const userId = crypto.randomUUID();
      const companyA = crypto.randomUUID();
      const companyB = crypto.randomUUID();
      await seedUser(userId);
      await seedCompany(companyA);
      await seedCompany(companyB);
      const companyUserId = await seedActor(companyA, userId);
      await seedPermission(companyUserId, "stock.view");
      await seedPermission(companyUserId, "stock.edit");
      await seedPermission(companyUserId, "items.view");

      const itemA = await seedItem(companyA, userId);
      const itemB = await seedItem(companyB, userId);

      await setActor(userId);
      await client.query("set local role authenticated");

      const visibleItems = await client.query(`select id from public.items where id = any($1::uuid[])`, [[itemA, itemB]]);
      expect(visibleItems.rows.map((row) => row.id)).toEqual([itemA]);

      const crossCompanyUpdate = await client.query(`update public.items set name = 'No permitido' where id = $1`, [itemB]);
      expect(crossCompanyUpdate.rowCount).toBe(0);

      await expectDbRejection(
        `
        insert into public.items (id, sku, name, unit, is_active, created_by, created_at, updated_at, demand_profile, company_id)
        values ($1, $2, 'No permitido', 'UN', true, $3, now(), now(), 'LOW', $4)
        `,
        [crypto.randomUUID(), `SKU-${crypto.randomUUID().slice(0, 8)}`, userId, companyB],
      );

      await expectDbRejection(
        `select public.upsert_product_combo_with_lines($1, null, $2, null, true, $3::jsonb)`,
        [
          companyB,
          "Combo no permitido",
          JSON.stringify([{ item_id: itemB, quantity: 1, line_order: 1, notes: null }]),
        ],
      );

      await expectDbRejection(`select public.create_company($1, $2)`, ["No permitida", `no-permitida-${crypto.randomUUID().slice(0, 8)}`]);
    });
  }, 15000);

  it("emite remito sin stock when the company allows it", async () => {
    await withRollback(async () => {
      const userId = crypto.randomUUID();
      const companyId = crypto.randomUUID();
      await seedUser(userId);
      await setActor(userId);
      await seedCompany(companyId);
      const companyUserId = await seedActor(companyId, userId);
      await seedPermission(companyUserId, "documents.issue");
      await client.query(
        `
        insert into public.company_settings (company_id, app_name, primary_color, secondary_color, accent_color, default_point_of_sale, allow_issue_remitos_without_stock, auto_close_cash_enabled)
        values ($1, 'Test', '#000000', '#111111', '#222222', 1, true, false)
        on conflict (company_id) do update set allow_issue_remitos_without_stock = excluded.allow_issue_remitos_without_stock
        `,
        [companyId],
      );

      const itemId = await seedItem(companyId, userId);
      const documentId = crypto.randomUUID();
      await client.query(
        `
        insert into public.documents (id, doc_type, status, point_of_sale, issue_date, subtotal, discount_total, total, tax_total, customer_kind, created_by, created_at, updated_at, company_id)
        values ($1, 'REMITO', 'BORRADOR', 1, current_date, 0, 0, 0, 0, 'GENERAL', $2, now(), now(), $3)
        `,
        [documentId, userId, companyId],
      );
      await client.query(
        `
        insert into public.document_lines (id, document_id, line_order, item_id, description, quantity, unit_price, discount_pct, line_total, created_by, created_at, updated_at, tax_pct, pricing_mode, suggested_unit_price)
        values ($1, $2, 1, $3, 'Line', 2, 100, 0, 200, $4, now(), now(), 0, 'MANUAL_PRICE', 100)
        `,
        [crypto.randomUUID(), documentId, itemId, userId],
      );

      const result = await client.query(`select status, document_number from public.issue_document($1)`, [documentId]);
      expect(result.rows[0].status).toBe("EMITIDO");
      expect(result.rows[0].document_number).toBe(1);

      const stock = await client.query(
        `select coalesce(sum(case type when 'IN' then quantity when 'OUT' then -quantity else quantity end), 0) as balance
         from public.stock_movements
         where company_id = $1 and item_id = $2`,
        [companyId, itemId],
      );
      expect(Number(stock.rows[0].balance)).toBe(-2);
    });
  });

  it("genera y no duplica DEBIT desde remito emitido", async () => {
    await withRollback(async () => {
      const userId = crypto.randomUUID();
      const companyId = crypto.randomUUID();
      await seedUser(userId);
      await setActor(userId);
      await seedCompany(companyId);
      const companyUserId = await seedActor(companyId, userId);
      await seedPermission(companyUserId, "documents.issue");
      await seedPermission(companyUserId, "customers.view");

      const customerId = await seedCustomer(companyId, "Cliente Cuenta");
      const itemId = await seedItem(companyId, userId);
      const documentId = crypto.randomUUID();
      await client.query(
        `insert into public.documents (id, doc_type, status, point_of_sale, issue_date, subtotal, discount_total, total, tax_total, customer_id, customer_name, customer_kind, payment_terms, created_by, created_at, updated_at, company_id)
         values ($1, 'REMITO', 'BORRADOR', 1, current_date, 100, 0, 100, 0, $2, 'Cliente Cuenta', 'GENERAL', 'CUENTA_CORRIENTE', $3, now(), now(), $4)`,
        [documentId, customerId, userId, companyId],
      );
      await client.query(
        `insert into public.document_lines (id, document_id, line_order, item_id, description, quantity, unit_price, discount_pct, line_total, created_by, created_at, updated_at, tax_pct, pricing_mode, suggested_unit_price)
         values ($1, $2, 1, $3, 'Line', 1, 100, 0, 100, $4, now(), now(), 0, 'MANUAL_PRICE', 100)`,
        [crypto.randomUUID(), documentId, itemId, userId],
      );

      await client.query(`select status from public.issue_document($1)`, [documentId]);
      await client.query(`select status from public.issue_document($1)`, [documentId]).catch(() => null);

      const entries = await client.query(
        `select entry_type, origin_type, origin_id, amount from public.customer_account_entries where document_id = $1`,
        [documentId],
      );
      expect(entries.rowCount).toBe(1);
      expect(entries.rows[0]).toMatchObject({ entry_type: "DEBIT", origin_type: "DOCUMENT" });
      expect(Number(entries.rows[0].amount)).toBe(100);
    });
  });

  it("remito devolucion genera stock IN y no permite devolver de mas", async () => {
    await withRollback(async () => {
      const userId = crypto.randomUUID();
      const companyId = crypto.randomUUID();
      await seedUser(userId);
      await setActor(userId);
      await seedCompany(companyId);
      const companyUserId = await seedActor(companyId, userId);
      await seedPermission(companyUserId, "documents.issue");

      const itemId = await seedItem(companyId, userId);
      const technicianId = crypto.randomUUID();
      await client.query(
        `insert into public.technicians (id, company_id, name, created_by, created_at, updated_at)
         values ($1, $2, 'Tecnico DB Test', $3, now(), now())`,
        [technicianId, companyId, userId],
      );
      await client.query(
        `insert into public.stock_movements (id, company_id, item_id, type, quantity, reference, notes, created_by, created_at)
         values ($1, $2, $3, 'IN', 5, 'seed', 'seed', $4, now())`,
        [crypto.randomUUID(), companyId, itemId, userId],
      );

      const originDocumentId = crypto.randomUUID();
      await client.query(
        `insert into public.documents (id, doc_type, status, point_of_sale, issue_date, subtotal, discount_total, total, tax_total, customer_kind, technician_id, created_by, created_at, updated_at, company_id)
         values ($1, 'REMITO', 'BORRADOR', 1, current_date, 100, 0, 100, 0, 'GENERAL', $2, $3, now(), now(), $4)`,
        [originDocumentId, technicianId, userId, companyId],
      );
      await client.query(
        `insert into public.document_lines (id, document_id, line_order, item_id, description, quantity, unit_price, discount_pct, line_total, created_by, created_at, updated_at, tax_pct, pricing_mode, suggested_unit_price)
         values ($1, $2, 1, $3, 'Line', 2, 50, 0, 100, $4, now(), now(), 0, 'MANUAL_PRICE', 50)`,
        [crypto.randomUUID(), originDocumentId, itemId, userId],
      );
      await client.query(`select status from public.issue_document($1)`, [originDocumentId]);

      const returnDocumentId = crypto.randomUUID();
      await client.query(
        `insert into public.documents (id, doc_type, status, point_of_sale, issue_date, subtotal, discount_total, total, tax_total, customer_kind, technician_id, origin_document_id, created_by, created_at, updated_at, company_id)
         values ($1, 'REMITO_DEVOLUCION', 'BORRADOR', 1, current_date, 50, 0, 50, 0, 'GENERAL', $2, $3, $4, now(), now(), $5)`,
        [returnDocumentId, technicianId, originDocumentId, userId, companyId],
      );
      await client.query(
        `insert into public.document_lines (id, document_id, line_order, item_id, description, quantity, unit_price, discount_pct, line_total, created_by, created_at, updated_at, tax_pct, pricing_mode, suggested_unit_price)
         values ($1, $2, 1, $3, 'Return', 1, 50, 0, 50, $4, now(), now(), 0, 'MANUAL_PRICE', 50)`,
        [crypto.randomUUID(), returnDocumentId, itemId, userId],
      );
      await client.query(`select status from public.issue_document($1)`, [returnDocumentId]);

      const stock = await client.query(
        `select coalesce(sum(case type when 'IN' then quantity when 'OUT' then -quantity else quantity end), 0) as balance
         from public.stock_movements where company_id = $1 and item_id = $2`,
        [companyId, itemId],
      );
      expect(Number(stock.rows[0].balance)).toBe(4);

      const overReturnDocumentId = crypto.randomUUID();
      await client.query(
        `insert into public.documents (id, doc_type, status, point_of_sale, issue_date, subtotal, discount_total, total, tax_total, customer_kind, technician_id, origin_document_id, created_by, created_at, updated_at, company_id)
         values ($1, 'REMITO_DEVOLUCION', 'BORRADOR', 1, current_date, 100, 0, 100, 0, 'GENERAL', $2, $3, $4, now(), now(), $5)`,
        [overReturnDocumentId, technicianId, originDocumentId, userId, companyId],
      );
      await client.query(
        `insert into public.document_lines (id, document_id, line_order, item_id, description, quantity, unit_price, discount_pct, line_total, created_by, created_at, updated_at, tax_pct, pricing_mode, suggested_unit_price)
         values ($1, $2, 1, $3, 'Over Return', 2, 50, 0, 100, $4, now(), now(), 0, 'MANUAL_PRICE', 50)`,
        [crypto.randomUUID(), overReturnDocumentId, itemId, userId],
      );

      await expect(client.query(`select status from public.issue_document($1)`, [overReturnDocumentId])).rejects.toThrow();
    });
  });

  it("no genera DEBIT para remito identificado sin condicion cuenta corriente", async () => {
    await withRollback(async () => {
      const userId = crypto.randomUUID();
      const companyId = crypto.randomUUID();
      await seedUser(userId);
      await setActor(userId);
      await seedCompany(companyId);
      const companyUserId = await seedActor(companyId, userId);
      await seedPermission(companyUserId, "documents.issue");
      await seedPermission(companyUserId, "customers.view");

      const customerId = await seedCustomer(companyId, "Cliente Contado");
      const itemId = await seedItem(companyId, userId);
      const documentId = crypto.randomUUID();
      await client.query(
        `insert into public.documents (id, doc_type, status, point_of_sale, issue_date, subtotal, discount_total, total, tax_total, customer_id, customer_name, customer_kind, payment_terms, created_by, created_at, updated_at, company_id)
         values ($1, 'REMITO', 'BORRADOR', 1, current_date, 100, 0, 100, 0, $2, 'Cliente Contado', 'GENERAL', 'CONTADO', $3, now(), now(), $4)`,
        [documentId, customerId, userId, companyId],
      );
      await client.query(
        `insert into public.document_lines (id, document_id, line_order, item_id, description, quantity, unit_price, discount_pct, line_total, created_by, created_at, updated_at, tax_pct, pricing_mode, suggested_unit_price)
         values ($1, $2, 1, $3, 'Line', 1, 100, 0, 100, $4, now(), now(), 0, 'MANUAL_PRICE', 100)`,
        [crypto.randomUUID(), documentId, itemId, userId],
      );

      await client.query(`select status from public.issue_document($1)`, [documentId]);

      const entries = await client.query(
        `select id from public.customer_account_entries where document_id = $1`,
        [documentId],
      );
      expect(entries.rowCount).toBe(0);
    });
  });

  it("no genera DEBIT para remito identificado con payment_terms null", async () => {
    await withRollback(async () => {
      const userId = crypto.randomUUID();
      const companyId = crypto.randomUUID();
      await seedUser(userId);
      await setActor(userId);
      await seedCompany(companyId);
      const companyUserId = await seedActor(companyId, userId);
      await seedPermission(companyUserId, "documents.issue");
      await seedPermission(companyUserId, "customers.view");

      const customerId = await seedCustomer(companyId, "Cliente Sin Terminos");
      const itemId = await seedItem(companyId, userId);
      const documentId = crypto.randomUUID();
      await client.query(
        `insert into public.documents (id, doc_type, status, point_of_sale, issue_date, subtotal, discount_total, total, tax_total, customer_id, customer_name, customer_kind, payment_terms, created_by, created_at, updated_at, company_id)
         values ($1, 'REMITO', 'BORRADOR', 1, current_date, 100, 0, 100, 0, $2, 'Cliente Sin Terminos', 'GENERAL', null, $3, now(), now(), $4)`,
        [documentId, customerId, userId, companyId],
      );
      await client.query(
        `insert into public.document_lines (id, document_id, line_order, item_id, description, quantity, unit_price, discount_pct, line_total, created_by, created_at, updated_at, tax_pct, pricing_mode, suggested_unit_price)
         values ($1, $2, 1, $3, 'Line', 1, 100, 0, 100, $4, now(), now(), 0, 'MANUAL_PRICE', 100)`,
        [crypto.randomUUID(), documentId, itemId, userId],
      );

      await client.query(`select status from public.issue_document($1)`, [documentId]);

      const entries = await client.query(
        `select id from public.customer_account_entries where document_id = $1`,
        [documentId],
      );
      expect(entries.rowCount).toBe(0);
    });
  });

  it("genera CREDIT para remito devolucion elegible y no duplica", async () => {
    await withRollback(async () => {
      const userId = crypto.randomUUID();
      const companyId = crypto.randomUUID();
      await seedUser(userId);
      await setActor(userId);
      await seedCompany(companyId);
      const companyUserId = await seedActor(companyId, userId);
      await seedPermission(companyUserId, "documents.issue");
      await seedPermission(companyUserId, "documents.cancel");
      await seedPermission(companyUserId, "customers.view");
      await seedPermission(companyUserId, "customers.create");

      const customerId = await seedCustomer(companyId, "Cliente Devolucion");
      const itemId = await seedItem(companyId, userId);
      const technicianId = crypto.randomUUID();
      await client.query(
        `insert into public.technicians (id, company_id, name, created_by, created_at, updated_at)
         values ($1, $2, 'Tecnico DB Test', $3, now(), now())`,
        [technicianId, companyId, userId],
      );
      await client.query(
        `insert into public.stock_movements (id, company_id, item_id, type, quantity, reference, notes, created_by, created_at)
         values ($1, $2, $3, 'IN', 5, 'seed', 'seed', $4, now())`,
        [crypto.randomUUID(), companyId, itemId, userId],
      );

      const originDocumentId = crypto.randomUUID();
      await client.query(
        `insert into public.documents (id, doc_type, status, point_of_sale, issue_date, subtotal, discount_total, total, tax_total, customer_id, customer_name, customer_kind, payment_terms, technician_id, created_by, created_at, updated_at, company_id)
         values ($1, 'REMITO', 'BORRADOR', 1, current_date, 100, 0, 100, 0, $2, 'Cliente Devolucion', 'GENERAL', 'CUENTA_CORRIENTE', $3, $4, now(), now(), $5)`,
        [originDocumentId, customerId, technicianId, userId, companyId],
      );
      await client.query(
        `insert into public.document_lines (id, document_id, line_order, item_id, description, quantity, unit_price, discount_pct, line_total, created_by, created_at, updated_at, tax_pct, pricing_mode, suggested_unit_price)
         values ($1, $2, 1, $3, 'Line', 2, 50, 0, 100, $4, now(), now(), 0, 'MANUAL_PRICE', 50)`,
        [crypto.randomUUID(), originDocumentId, itemId, userId],
      );
      await client.query(`select status from public.issue_document($1)`, [originDocumentId]);

      const returnDocumentId = crypto.randomUUID();
      await client.query(
        `insert into public.documents (id, doc_type, status, point_of_sale, issue_date, subtotal, discount_total, total, tax_total, customer_id, customer_name, customer_kind, payment_terms, technician_id, origin_document_id, created_by, created_at, updated_at, company_id)
         values ($1, 'REMITO_DEVOLUCION', 'BORRADOR', 1, current_date, 50, 0, 50, 0, $2, 'Cliente Devolucion', 'GENERAL', 'CUENTA_CORRIENTE', $3, $4, $5, now(), now(), $6)`,
        [returnDocumentId, customerId, technicianId, originDocumentId, userId, companyId],
      );
      await client.query(
        `insert into public.document_lines (id, document_id, line_order, item_id, description, quantity, unit_price, discount_pct, line_total, created_by, created_at, updated_at, tax_pct, pricing_mode, suggested_unit_price)
         values ($1, $2, 1, $3, 'Return', 1, 50, 0, 50, $4, now(), now(), 0, 'MANUAL_PRICE', 50)`,
        [crypto.randomUUID(), returnDocumentId, itemId, userId],
      );
      await client.query(`select status from public.issue_document($1)`, [returnDocumentId]);
      await client.query(`select public.register_customer_account_credit_from_document($1)`, [returnDocumentId]);

      const entries = await client.query(
        `select id, entry_type, origin_type, origin_id, amount, metadata from public.customer_account_entries where document_id = $1 order by created_at`,
        [returnDocumentId],
      );
      expect(entries.rowCount).toBe(1);
      expect(entries.rows[0]).toMatchObject({ entry_type: "CREDIT", origin_type: "DOCUMENT", origin_id: returnDocumentId });
      expect(Number(entries.rows[0].amount)).toBe(50);
      expect(entries.rows[0].metadata.origin_document_id).toBe(originDocumentId);

      await client.query(`select status from public.transition_document_status($1, 'ANULADO')`, [returnDocumentId]);
      const reversed = await client.query(
        `select id, entry_type, origin_type, origin_id, amount, metadata from public.customer_account_entries where document_id = $1 order by created_at`,
        [returnDocumentId],
      );
      expect(reversed.rowCount).toBe(2);
      expect(reversed.rows.map((row) => row.entry_type)).toEqual(["CREDIT", "DEBIT"]);
      expect(Number(reversed.rows[1].amount)).toBe(50);
      expect(reversed.rows[1].metadata.reverses_entry_id).toBe(entries.rows[0].id);
    });
  });

  it("no genera CREDIT para remito devolucion de cliente ocasional", async () => {
    await withRollback(async () => {
      const userId = crypto.randomUUID();
      const companyId = crypto.randomUUID();
      await seedUser(userId);
      await setActor(userId);
      await seedCompany(companyId);
      const customerId = await seedCustomer(companyId, "Cliente Ocasional", true);
      const technicianId = crypto.randomUUID();
      await client.query(
        `insert into public.technicians (id, company_id, name, created_by, created_at, updated_at)
         values ($1, $2, 'Tecnico DB Test', $3, now(), now())`,
        [technicianId, companyId, userId],
      );

      const originDocumentId = crypto.randomUUID();
      const returnDocumentId = crypto.randomUUID();
      await client.query(
        `insert into public.documents (id, doc_type, status, point_of_sale, document_number, issue_date, subtotal, discount_total, total, tax_total, customer_id, customer_name, customer_kind, payment_terms, technician_id, created_by, created_at, updated_at, company_id)
         values ($1, 'REMITO', 'EMITIDO', 1, 11, current_date, 100, 0, 100, 0, $2, 'Cliente Ocasional', 'GENERAL', 'CUENTA_CORRIENTE', $3, $4, now(), now(), $5)`,
        [originDocumentId, customerId, technicianId, userId, companyId],
      );
      await client.query(
        `insert into public.documents (id, doc_type, status, point_of_sale, document_number, issue_date, subtotal, discount_total, total, tax_total, customer_id, customer_name, customer_kind, payment_terms, technician_id, origin_document_id, created_by, created_at, updated_at, company_id)
         values ($1, 'REMITO_DEVOLUCION', 'EMITIDO', 1, 12, current_date, 50, 0, 50, 0, $2, 'Cliente Ocasional', 'GENERAL', 'CUENTA_CORRIENTE', $3, $4, $5, now(), now(), $6)`,
        [returnDocumentId, customerId, technicianId, originDocumentId, userId, companyId],
      );

      await client.query(`select public.register_customer_account_credit_from_document($1)`, [returnDocumentId]);
      const entries = await client.query(
        `select id from public.customer_account_entries where document_id = $1`,
        [returnDocumentId],
      );
      expect(entries.rowCount).toBe(0);
    });
  });

  it("registra cash_adjustment negativo para remito devolucion y bloquea duplicados", async () => {
    await withRollback(async () => {
      const userId = crypto.randomUUID();
      const companyId = crypto.randomUUID();
      await seedUser(userId);
      await setActor(userId);
      await seedCompany(companyId);
      const companyUserId = await seedActor(companyId, userId);
      await seedPermission(companyUserId, "cash.create");
      await seedPermission(companyUserId, "cash.view");

      const returnDocumentId = crypto.randomUUID();
      await client.query(
        `insert into public.documents (id, doc_type, status, point_of_sale, document_number, issue_date, subtotal, discount_total, total, tax_total, customer_name, customer_kind, payment_terms, created_by, created_at, updated_at, company_id)
         values ($1, 'REMITO_DEVOLUCION', 'EMITIDO', 1, 22, current_date, 80, 0, 80, 0, 'Cliente Ajuste', 'GENERAL', 'CONTADO', $2, now(), now(), $3)`,
        [returnDocumentId, userId, companyId],
      );

      const adjustment = await client.query(
        `select amount_total, signed_amount, payment_method, adjustment_kind from public.register_cash_adjustment_from_return($1, current_date, 'QA')`,
        [returnDocumentId],
      );
      expect(Number(adjustment.rows[0].amount_total)).toBe(80);
      expect(Number(adjustment.rows[0].signed_amount)).toBe(-80);
      expect(adjustment.rows[0].payment_method).toBe("SERVICIOS_REMITO");
      expect(adjustment.rows[0].adjustment_kind).toBe("REMITO_DEVOLUCION");

      await expect(
        client.query(`select public.register_cash_adjustment_from_return($1, current_date, 'duplicado')`, [returnDocumentId]),
      ).rejects.toThrow();
    });
  });

  it("bloquea cancelacion de cash_adjustment incluido en cierre cerrado", async () => {
    await withRollback(async () => {
      const userId = crypto.randomUUID();
      const companyId = crypto.randomUUID();
      await seedUser(userId);
      await setActor(userId);
      await seedCompany(companyId);
      const companyUserId = await seedActor(companyId, userId);
      await seedPermission(companyUserId, "cash.create");
      await seedPermission(companyUserId, "cash.view");
      await seedPermission(companyUserId, "cash.close");
      await seedPermission(companyUserId, "cash.cancel");

      const returnDocumentId = crypto.randomUUID();
      await client.query(
        `insert into public.documents (id, doc_type, status, point_of_sale, document_number, issue_date, subtotal, discount_total, total, tax_total, customer_name, customer_kind, payment_terms, created_by, created_at, updated_at, company_id)
         values ($1, 'REMITO_DEVOLUCION', 'EMITIDO', 1, 23, current_date, 90, 0, 90, 0, 'Cliente Cierre', 'GENERAL', 'CONTADO', $2, now(), now(), $3)`,
        [returnDocumentId, userId, companyId],
      );

      const adjustment = await client.query(
        `select id from public.register_cash_adjustment_from_return($1, current_date, 'QA')`,
        [returnDocumentId],
      );
      const closure = await client.query(
        `select id from public.cash_closures where company_id = $1 and business_date = current_date`,
        [companyId],
      );
      await client.query(`select public.close_cash_closure($1, null, null, null, 'QA')`, [closure.rows[0].id]);

      await expect(client.query(`select public.cancel_cash_adjustment($1, 'QA')`, [adjustment.rows[0].id])).rejects.toThrow();
    });
  });

  it("anula remito emitido y devuelve stock", async () => {
    await withRollback(async () => {
      const userId = crypto.randomUUID();
      const companyId = crypto.randomUUID();
      await seedUser(userId);
      await setActor(userId);
      await seedCompany(companyId);
      const companyUserId = await seedActor(companyId, userId);
      await seedPermission(companyUserId, "documents.issue");
      await seedPermission(companyUserId, "documents.cancel");
      await client.query(
        `
        insert into public.company_settings (company_id, app_name, primary_color, secondary_color, accent_color, default_point_of_sale, allow_issue_remitos_without_stock, auto_close_cash_enabled)
        values ($1, 'Test', '#000000', '#111111', '#222222', 1, true, false)
        on conflict (company_id) do update set allow_issue_remitos_without_stock = excluded.allow_issue_remitos_without_stock
        `,
        [companyId],
      );

      const itemId = await seedItem(companyId, userId);
      await client.query(
        `insert into public.stock_movements (id, company_id, item_id, type, quantity, reference, notes, created_by, created_at)
         values ($1, $2, $3, 'IN', 5, 'seed', 'seed', $4, now())`,
        [crypto.randomUUID(), companyId, itemId, userId],
      );

      const documentId = crypto.randomUUID();
      await client.query(
        `insert into public.documents (id, doc_type, status, point_of_sale, issue_date, subtotal, discount_total, total, tax_total, customer_kind, created_by, created_at, updated_at, company_id)
         values ($1, 'REMITO', 'BORRADOR', 1, current_date, 0, 0, 0, 0, 'GENERAL', $2, now(), now(), $3)`,
        [documentId, userId, companyId],
      );
      await client.query(
        `insert into public.document_lines (id, document_id, line_order, item_id, description, quantity, unit_price, discount_pct, line_total, created_by, created_at, updated_at, tax_pct, pricing_mode, suggested_unit_price)
         values ($1, $2, 1, $3, 'Line', 2, 100, 0, 200, $4, now(), now(), 0, 'MANUAL_PRICE', 100)`,
        [crypto.randomUUID(), documentId, itemId, userId],
      );

      await client.query(`select status from public.issue_document($1)`, [documentId]);
      const before = await client.query(
        `select coalesce(sum(case type when 'IN' then quantity when 'OUT' then -quantity else quantity end), 0) as balance from public.stock_movements where company_id = $1 and item_id = $2`,
        [companyId, itemId],
      );
      expect(Number(before.rows[0].balance)).toBe(3);

      await client.query(`select status from public.transition_document_status($1, 'ANULADO')`, [documentId]);
      const after = await client.query(
        `select coalesce(sum(case type when 'IN' then quantity when 'OUT' then -quantity else quantity end), 0) as balance from public.stock_movements where company_id = $1 and item_id = $2`,
        [companyId, itemId],
      );
      expect(Number(after.rows[0].balance)).toBe(5);
    });
  }, 15000);

  it("bloquea cambios de factura externa si el remito ya se usó en caja", async () => {
    await withRollback(async () => {
      const userId = crypto.randomUUID();
      const companyId = crypto.randomUUID();
      await seedUser(userId);
      await setActor(userId);
      await seedCompany(companyId);
      const companyUserId = await seedActor(companyId, userId);
      await seedPermission(companyUserId, "documents.issue");
      await client.query(
        `
        insert into public.company_settings (company_id, app_name, primary_color, secondary_color, accent_color, default_point_of_sale, allow_issue_remitos_without_stock, auto_close_cash_enabled)
        values ($1, 'Test', '#000000', '#111111', '#222222', 1, true, false)
        on conflict (company_id) do update set allow_issue_remitos_without_stock = excluded.allow_issue_remitos_without_stock
        `,
        [companyId],
      );

      const itemId = await seedItem(companyId, userId);
      const documentId = crypto.randomUUID();
      await client.query(
        `insert into public.documents (id, doc_type, status, point_of_sale, issue_date, subtotal, discount_total, total, tax_total, customer_kind, created_by, created_at, updated_at, company_id)
         values ($1, 'REMITO', 'BORRADOR', 1, current_date, 0, 0, 0, 0, 'GENERAL', $2, now(), now(), $3)`,
        [documentId, userId, companyId],
      );
      await client.query(
        `insert into public.document_lines (id, document_id, line_order, item_id, description, quantity, unit_price, discount_pct, line_total, created_by, created_at, updated_at, tax_pct, pricing_mode, suggested_unit_price)
         values ($1, $2, 1, $3, 'Line', 1, 100, 0, 100, $4, now(), now(), 0, 'MANUAL_PRICE', 100)`,
        [crypto.randomUUID(), documentId, itemId, userId],
      );
      await client.query(`select status from public.issue_document($1)`, [documentId]);
      await client.query(
        `
        insert into public.cash_sales (id, business_date, sold_at, payment_method, receipt_kind, status, document_id, receipt_reference, amount_total, created_by, created_at, updated_at, company_id)
        values ($1, current_date, now(), 'EFECTIVO', 'REMITO', 'REGISTRADA', $2, 'REMITO 0001-00000001', 100, $3, now(), now(), $4)
        `,
        [crypto.randomUUID(), documentId, userId, companyId],
      );

      await expect(client.query(`select * from public.set_document_external_invoice($1, $2, current_date)`, [documentId, "F-001-0001"])).rejects.toThrow();
      await expect(client.query(`select * from public.clear_document_external_invoice($1)`, [documentId])).rejects.toThrow();
    });
  });

  it("genera DEBIT desde cash_sale y no duplica en reintento", async () => {
    await withRollback(async () => {
      const userId = crypto.randomUUID();
      const companyId = crypto.randomUUID();
      await seedUser(userId);
      await setActor(userId);
      await seedCompany(companyId);
      const companyUserId = await seedActor(companyId, userId);
      await seedPermission(companyUserId, "customers.view");

      const customerId = await seedCustomer(companyId, "Cliente Caja");
      const saleId = crypto.randomUUID();
      await client.query(
        `insert into public.cash_sales (id, business_date, sold_at, payment_method, receipt_kind, status, amount_total, customer_id, customer_name_snapshot, created_by, created_at, updated_at, company_id)
         values ($1, current_date, now(), 'CUENTA_CORRIENTE', 'PENDIENTE', 'REGISTRADA', 100, $2, 'Cliente Caja', $3, now(), now(), $4)`,
        [saleId, customerId, userId, companyId],
      );

      const entries = await client.query(
        `select entry_type, origin_type, origin_id, amount from public.customer_account_entries where cash_sale_id = $1`,
        [saleId],
      );
      expect(entries.rowCount).toBe(1);
      expect(entries.rows[0]).toMatchObject({ entry_type: "DEBIT", origin_type: "CASH_SALE" });
      expect(Number(entries.rows[0].amount)).toBe(100);

      await client.query(`update public.cash_sales set amount_total = amount_total where id = $1`, [saleId]);
      const duplicated = await client.query(
        `select count(*)::int as count from public.customer_account_entries where cash_sale_id = $1`,
        [saleId],
      );
      expect(duplicated.rows[0].count).toBe(1);
    });
  });

  it("bloquea cuenta corriente con cliente ocasional", async () => {
    await withRollback(async () => {
      const userId = crypto.randomUUID();
      const companyId = crypto.randomUUID();
      await seedUser(userId);
      await setActor(userId);
      await seedCompany(companyId);
      const companyUserId = await seedActor(companyId, userId);
      await seedPermission(companyUserId, "customers.view");

      const customerId = await seedCustomer(companyId, "Ocasional", true);
      await expect(
        client.query(
          `insert into public.cash_sales (id, business_date, sold_at, payment_method, receipt_kind, status, amount_total, customer_id, customer_name_snapshot, created_by, created_at, updated_at, company_id)
           values ($1, current_date, now(), 'CUENTA_CORRIENTE', 'PENDIENTE', 'REGISTRADA', 100, $2, 'Ocasional', $3, now(), now(), $4)`,
          [crypto.randomUUID(), customerId, userId, companyId],
        ),
      ).rejects.toThrow();
    });
  });

  it("mantiene el saldo con debito y credito manual", async () => {
    await withRollback(async () => {
      const userId = crypto.randomUUID();
      const companyId = crypto.randomUUID();
      await seedUser(userId);
      await setActor(userId);
      await seedCompany(companyId);
      const companyUserId = await seedActor(companyId, userId);
      await seedPermission(companyUserId, "customers.view");

      const customerId = await seedCustomer(companyId, "Cliente Saldo");
      await client.query(
        `insert into public.customer_account_entries (id, company_id, customer_id, entry_type, origin_type, origin_id, amount, business_date, description, created_by, created_at)
         values ($1, $2, $3, 'DEBIT', 'MANUAL', $4, 100, current_date, 'Debito', $5, now())`,
        [crypto.randomUUID(), companyId, customerId, crypto.randomUUID(), userId],
      );
      await client.query(
        `insert into public.customer_account_entries (id, company_id, customer_id, entry_type, origin_type, origin_id, amount, business_date, description, created_by, created_at)
         values ($1, $2, $3, 'CREDIT', 'MANUAL', $4, 40, current_date, 'Credito', $5, now())`,
        [crypto.randomUUID(), companyId, customerId, crypto.randomUUID(), userId],
      );

      const balance = await client.query(
        `select balance from public.customer_account_balances where company_id = $1 and customer_id = $2`,
        [companyId, customerId],
      );
      expect(Number(balance.rows[0].balance)).toBe(60);
    });
  });

  it("duplica presupuesto como borrador sin numero y conserva lineas", async () => {
    await withRollback(async () => {
      const userId = crypto.randomUUID();
      const companyId = crypto.randomUUID();
      await seedUser(userId);
      await setActor(userId);
      await seedCompany(companyId);
      const companyUserId = await seedActor(companyId, userId);
      await seedPermission(companyUserId, "documents.create");

      const itemId = await seedItem(companyId, userId);
      const sourceId = crypto.randomUUID();
      await client.query(
        `insert into public.documents (
          id, doc_type, status, point_of_sale, document_number, issue_date, subtotal, discount_total, total, tax_total,
          customer_name, customer_tax_id, customer_tax_condition, customer_kind, payment_terms, delivery_address,
          salesperson, notes, created_by, created_at, updated_at, company_id
        )
        values (
          $1, 'PRESUPUESTO', 'APROBADO', 3, 22, current_date - 5, 250, 0, 250, 0,
          'Cliente Test', '20-123', 'RI', 'GENERAL', 'Contado', 'Deposito',
          'Vendedor', 'Notas fuente', $2, now(), now(), $3
        )`,
        [sourceId, userId, companyId],
      );
      await client.query(
        `insert into public.document_lines (
          id, document_id, line_order, item_id, description, quantity, unit_price, discount_pct, line_total,
          created_by, created_at, updated_at, tax_pct, pricing_mode, suggested_unit_price, base_cost_snapshot,
          list_flete_pct_snapshot, list_utilidad_pct_snapshot, list_impuesto_pct_snapshot, manual_margin_pct
        )
        values ($1, $2, 1, $3, 'Line', 2, 125, 0, 250, $4, now(), now(), 0, 'MANUAL_PRICE', 150, 90, 10, 20, 21, 30)`,
        [crypto.randomUUID(), sourceId, itemId, userId],
      );

      const duplicated = await client.query(`select * from public.duplicate_document($1)`, [sourceId]);
      const newDoc = duplicated.rows[0];
      expect(newDoc.doc_type).toBe("PRESUPUESTO");
      expect(newDoc.status).toBe("BORRADOR");
      expect(newDoc.document_number).toBeNull();
      expect(newDoc.source_document_id).toBe(sourceId);
      expect(newDoc.source_document_type).toBe("PRESUPUESTO");
      expect(newDoc.source_document_number_snapshot).toBe("0003-00000022");

      const lines = await client.query(
        `select item_id, quantity, unit_price, pricing_mode, suggested_unit_price, base_cost_snapshot, manual_margin_pct
         from public.document_lines where document_id = $1`,
        [newDoc.id],
      );
      expect(lines.rowCount).toBe(1);
      expect(lines.rows[0]).toMatchObject({ item_id: itemId, pricing_mode: "MANUAL_PRICE" });
      expect(Number(lines.rows[0].quantity)).toBe(2);
      expect(Number(lines.rows[0].unit_price)).toBe(125);
      expect(Number(lines.rows[0].suggested_unit_price)).toBe(150);
      expect(Number(lines.rows[0].base_cost_snapshot)).toBe(90);
      expect(Number(lines.rows[0].manual_margin_pct)).toBe(30);
    });
  });

  it("duplica remito sin factura externa ni movimientos de stock y bloquea devoluciones", async () => {
    await withRollback(async () => {
      const userId = crypto.randomUUID();
      const companyId = crypto.randomUUID();
      await seedUser(userId);
      await setActor(userId);
      await seedCompany(companyId);
      const companyUserId = await seedActor(companyId, userId);
      await seedPermission(companyUserId, "documents.create");

      const itemId = await seedItem(companyId, userId);
      const sourceId = crypto.randomUUID();
      await client.query(
        `insert into public.documents (
          id, doc_type, status, point_of_sale, document_number, issue_date, subtotal, discount_total, total, tax_total,
          customer_kind, external_invoice_number, external_invoice_date, external_invoice_status,
          created_by, created_at, updated_at, company_id
        )
        values ($1, 'REMITO', 'EMITIDO', 1, 9, current_date - 2, 100, 0, 100, 0, 'GENERAL', 'F-001', current_date, 'ACTIVE', $2, now(), now(), $3)`,
        [sourceId, userId, companyId],
      );
      await client.query(
        `insert into public.document_lines (id, document_id, line_order, item_id, description, quantity, unit_price, discount_pct, line_total, created_by, created_at, updated_at, tax_pct, pricing_mode, suggested_unit_price)
         values ($1, $2, 1, $3, 'Line', 1, 100, 0, 100, $4, now(), now(), 0, 'LIST_PRICE', 100)`,
        [crypto.randomUUID(), sourceId, itemId, userId],
      );

      const duplicated = await client.query(`select * from public.duplicate_document($1)`, [sourceId]);
      const newDoc = duplicated.rows[0];
      expect(newDoc.doc_type).toBe("REMITO");
      expect(newDoc.status).toBe("BORRADOR");
      expect(newDoc.document_number).toBeNull();
      expect(newDoc.external_invoice_number).toBeNull();
      expect(newDoc.external_invoice_date).toBeNull();
      expect(newDoc.external_invoice_status).toBeNull();

      const stock = await client.query(
        `select count(*)::int as count from public.stock_movements where company_id = $1 and reference ilike '%' || $2 || '%'`,
        [companyId, newDoc.id],
      );
      expect(stock.rows[0].count).toBe(0);

      const returnId = crypto.randomUUID();
      await client.query(
        `insert into public.documents (id, doc_type, status, point_of_sale, issue_date, subtotal, discount_total, total, tax_total, customer_kind, created_by, created_at, updated_at, company_id)
         values ($1, 'REMITO_DEVOLUCION', 'BORRADOR', 1, current_date, 0, 0, 0, 0, 'GENERAL', $2, now(), now(), $3)`,
        [returnId, userId, companyId],
      );

      await expect(client.query(`select * from public.duplicate_document($1)`, [returnId])).rejects.toThrow();
    });
  });

  it("guarda combos de manera atomica con rpc y reemplaza sus lineas al editar", async () => {
    await withRollback(async () => {
      const userId = crypto.randomUUID();
      const companyId = crypto.randomUUID();
      await seedUser(userId);
      await setActor(userId);
      await seedCompany(companyId);
      const companyUserId = await seedActor(companyId, userId);
      await seedPermission(companyUserId, "items.view");

      const item1 = await seedItem(companyId, userId);
      const item2 = await seedItem(companyId, userId);
      const item3 = await seedItem(companyId, userId);

      const created = await client.query(
        `select public.upsert_product_combo_with_lines($1, null, $2, $3, true, $4::jsonb) as id`,
        [
          companyId,
          "Kit AT",
          "Base",
          JSON.stringify([
            { item_id: item1, quantity: 3, line_order: 1, notes: null },
            { item_id: item2, quantity: 2, line_order: 2, notes: null },
          ]),
        ],
      );
      const comboId = created.rows[0].id as string;
      const createdLines = await client.query(
        `select item_id, quantity, line_order from public.product_combo_lines where combo_id = $1 order by line_order`,
        [comboId],
      );
      expect(createdLines.rowCount).toBe(2);
      expect(Number(createdLines.rows[0].quantity)).toBe(3);
      expect(createdLines.rows[0].item_id).toBe(item1);

      await client.query(
        `select public.upsert_product_combo_with_lines($1, $2, $3, $4, false, $5::jsonb)`,
        [
          companyId,
          comboId,
          "Kit AT",
          "Editado",
          JSON.stringify([
            { item_id: item2, quantity: 5, line_order: 1, notes: null },
            { item_id: item3, quantity: 1, line_order: 2, notes: null },
          ]),
        ],
      );

      const updated = await client.query(`select description, is_active from public.product_combos where id = $1`, [comboId]);
      expect(updated.rows[0].description).toBe("Editado");
      expect(updated.rows[0].is_active).toBe(false);
      const updatedLines = await client.query(
        `select item_id, quantity from public.product_combo_lines where combo_id = $1 order by line_order`,
        [comboId],
      );
      expect(updatedLines.rowCount).toBe(2);
      expect(updatedLines.rows[0].item_id).toBe(item2);
      expect(Number(updatedLines.rows[0].quantity)).toBe(5);
      expect(updatedLines.rows[1].item_id).toBe(item3);
    });
  }, 15000);

  it("rechaza combos invalidos sin dejar persistencia parcial", async () => {
    await withRollback(async () => {
      const userId = crypto.randomUUID();
      const companyId = crypto.randomUUID();
      await seedUser(userId);
      await setActor(userId);
      await seedCompany(companyId);
      const companyUserId = await seedActor(companyId, userId);
      await seedPermission(companyUserId, "items.view");

      const item1 = await seedItem(companyId, userId);
      const otherCompany = crypto.randomUUID();
      await seedCompany(otherCompany);
      const otherItem = await seedItem(otherCompany, userId);

      await expect(
        client.query(
          `select public.upsert_product_combo_with_lines($1, null, $2, $3, true, $4::jsonb)`,
          [
            companyId,
            "Combo invalido",
            null,
            JSON.stringify([{ item_id: item1, quantity: 0, line_order: 1, notes: null }]),
          ],
        ),
      ).rejects.toThrow();

      await expect(
        client.query(
          `select public.upsert_product_combo_with_lines($1, null, $2, $3, true, $4::jsonb)`,
          [
            companyId,
            "Combo otro item",
            null,
            JSON.stringify([{ item_id: otherItem, quantity: 1, line_order: 1, notes: null }]),
          ],
        ),
      ).rejects.toThrow();

      const combos = await client.query(`select count(*)::int as count from public.product_combos where company_id = $1`, [companyId]);
      expect(combos.rows[0].count).toBe(0);
    });
  }, 15000);

  it("cierra caja y calcula el efectivo esperado", async () => {
    await withRollback(async () => {
      const userId = crypto.randomUUID();
      const companyId = crypto.randomUUID();
      await seedUser(userId);
      await setActor(userId);
      await seedCompany(companyId);
      const companyUserId = await seedActor(companyId, userId);
      await seedPermission(companyUserId, "cash.view");
      await seedPermission(companyUserId, "cash.close");
      await client.query(
        `
        insert into public.company_settings (company_id, app_name, primary_color, secondary_color, accent_color, default_point_of_sale, allow_issue_remitos_without_stock, auto_close_cash_enabled)
        values ($1, 'Test', '#000000', '#111111', '#222222', 1, false, false)
        on conflict (company_id) do update set auto_close_cash_enabled = excluded.auto_close_cash_enabled
        `,
        [companyId],
      );

      const closureResult = await client.query(
        `select * from public.get_or_create_cash_closure(current_date, $1)`,
        [companyId],
      );
      const closureId = closureResult.rows[0].id;

      await client.query(
        `
        insert into public.cash_sales (id, business_date, sold_at, payment_method, receipt_kind, status, amount_total, created_by, created_at, updated_at, company_id)
        values ($1, current_date, now(), 'EFECTIVO', 'PENDIENTE', 'REGISTRADA', 120, $2, now(), now(), $3)
        `,
        [crypto.randomUUID(), userId, companyId],
      );

      const closed = await client.query(
        `select status, expected_cash_to_render, cash_difference from public.close_cash_closure($1, $2, $3, $4, $5)`,
        [closureId, 120, null, null, "Cierre de prueba"],
      );

      expect(closed.rows[0].status).toBe("CERRADO");
      expect(Number(closed.rows[0].expected_cash_to_render)).toBe(120);
      expect(Number(closed.rows[0].cash_difference)).toBe(0);
    });
  });
});
