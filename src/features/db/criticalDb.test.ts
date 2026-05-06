import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import crypto from "node:crypto";

const DB_HOST = "db.tihjnbfdjnjobxxecuaz.supabase.co";
const DB_PASSWORD = process.env.PGPASSWORD;

if (!DB_PASSWORD) {
  throw new Error("PGPASSWORD is required to run critical DB tests");
}

const client = new Client({
  host: DB_HOST,
  port: 5432,
  user: "postgres",
  password: DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

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

describe("critical database rules", () => {
  beforeAll(async () => {
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

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
  });

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
