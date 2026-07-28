import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

const DEFAULT_DB_HOST = "db.tihjnbfdjnjobxxecuaz.supabase.co";
const DB_PASSWORD = process.env.PGPASSWORD ?? "";
const DATABASE_URL = process.env.DATABASE_URL;
const describeDb = DATABASE_URL || DB_PASSWORD ? describe : describe.skip;
const migrationSql = readFileSync(
  path.join(process.cwd(), "supabase/migrations/20260728120000_scope_price_list_pending_recalculation.sql"),
  "utf8",
);

let client: Client;

function shouldUseSsl(connectionString: string) {
  const hostname = new URL(connectionString).hostname;
  return !["127.0.0.1", "localhost", "::1"].includes(hostname);
}

async function createDbClient() {
  const dbClient = DATABASE_URL
    ? new Client({
        connectionString: DATABASE_URL,
        ssl: shouldUseSsl(DATABASE_URL) ? { rejectUnauthorized: false } : undefined,
      })
    : new Client({
        host: process.env.PGHOST ?? DEFAULT_DB_HOST,
        port: Number(process.env.PGPORT ?? 5432),
        user: process.env.PGUSER ?? "postgres",
        password: DB_PASSWORD,
        database: process.env.PGDATABASE ?? "postgres",
        ssl: { rejectUnauthorized: false },
      });

  await dbClient.connect();
  return dbClient;
}

type Fixture = {
  companyA: string;
  companyB: string;
  listA: string;
  listA2: string;
  listB: string;
  itemA: string;
  itemA2: string;
  inactiveItemA: string;
  itemB: string;
};

async function seedFixture(): Promise<Fixture> {
  const ids: Fixture = {
    companyA: crypto.randomUUID(),
    companyB: crypto.randomUUID(),
    listA: crypto.randomUUID(),
    listA2: crypto.randomUUID(),
    listB: crypto.randomUUID(),
    itemA: crypto.randomUUID(),
    itemA2: crypto.randomUUID(),
    inactiveItemA: crypto.randomUUID(),
    itemB: crypto.randomUUID(),
  };

  await client.query(
    `
    insert into public.companies (id, name, slug, status, created_at, updated_at)
    values
      ($1, 'Price scope DB A', $2, 'ACTIVE', now(), now()),
      ($3, 'Price scope DB B', $4, 'ACTIVE', now(), now())
    `,
    [
      ids.companyA,
      `price-scope-a-${ids.companyA.slice(0, 8)}`,
      ids.companyB,
      `price-scope-b-${ids.companyB.slice(0, 8)}`,
    ],
  );

  await client.query(
    `
    insert into public.items (
      id, company_id, sku, name, unit, is_active, demand_profile, created_at, updated_at
    )
    values
      ($1, $2, $3, 'Item A', 'UN', true, 'LOW', now(), now()),
      ($4, $2, $5, 'Item A2', 'UN', true, 'LOW', now(), now()),
      ($6, $2, $7, 'Item A inactive', 'UN', true, 'LOW', now(), now()),
      ($8, $9, $10, 'Item B', 'UN', true, 'LOW', now(), now())
    `,
    [
      ids.itemA,
      ids.companyA,
      `PS-A-${ids.itemA.slice(0, 8)}`,
      ids.itemA2,
      `PS-A2-${ids.itemA2.slice(0, 8)}`,
      ids.inactiveItemA,
      `PS-AI-${ids.inactiveItemA.slice(0, 8)}`,
      ids.itemB,
      ids.companyB,
      `PS-B-${ids.itemB.slice(0, 8)}`,
    ],
  );

  await client.query(
    `
    insert into public.price_lists (id, company_id, name)
    values
      ($1, $2, 'DB scope list A'),
      ($3, $2, 'DB scope list A2'),
      ($4, $5, 'DB scope list B')
    `,
    [ids.listA, ids.companyA, ids.listA2, ids.listB, ids.companyB],
  );

  await client.query(`update public.items set is_active = false where id = $1 and company_id = $2`, [
    ids.inactiveItemA,
    ids.companyA,
  ]);
  await client.query(
    `
    update public.price_list_items
    set needs_recalculation = false,
        last_calculated_at = null,
        last_calculated_by = null
    where company_id in ($1, $2)
    `,
    [ids.companyA, ids.companyB],
  );

  return ids;
}

async function withMigratedFixture<T>(assertion: (fixture: Fixture) => Promise<T>) {
  await client.query("begin");
  try {
    // The migration is exercised inside the transaction and is never applied persistently.
    await client.query(migrationSql);
    const fixture = await seedFixture();
    const result = await assertion(fixture);
    await client.query("rollback");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

describeDb("price-list pending recalculation DB regression", () => {
  beforeAll(async () => {
    client = await createDbClient();
  });

  afterAll(async () => {
    await client?.end();
  });

  it("does not reactivate or recalculate an inactive row and skips an active non-pending row", async () => {
    await withMigratedFixture(async ({ companyA, listA, itemA, itemA2, inactiveItemA }) => {
      await client.query(
        `
        update public.price_list_items
        set needs_recalculation = true
        where company_id = $1 and price_list_id = $2 and item_id = $3
        `,
        [companyA, listA, itemA],
      );

      const recalculation = await client.query<{ affected: number }>(
        `select public.recalculate_price_list($1, null) as affected`,
        [listA],
      );
      expect(recalculation.rows[0].affected).toBe(1);

      const rows = await client.query<{
        item_id: string;
        is_active: boolean;
        needs_recalculation: boolean;
        was_calculated: boolean;
      }>(
        `
        select
          item_id,
          is_active,
          needs_recalculation,
          last_calculated_at is not null as was_calculated
        from public.price_list_items
        where company_id = $1
          and price_list_id = $2
          and item_id = any($3::uuid[])
        `,
        [companyA, listA, [itemA, itemA2, inactiveItemA]],
      );
      const byItem = Object.fromEntries(rows.rows.map((row) => [row.item_id, row]));

      expect(byItem[itemA]).toMatchObject({
        is_active: true,
        needs_recalculation: false,
        was_calculated: true,
      });
      expect(byItem[itemA2]).toMatchObject({
        is_active: true,
        needs_recalculation: false,
        was_calculated: false,
      });
      expect(byItem[inactiveItemA]).toMatchObject({
        is_active: false,
        needs_recalculation: false,
        was_calculated: false,
      });
    });
  });

  it("marks only the affected company and item when the base cost really changes", async () => {
    await withMigratedFixture(async ({ companyA, companyB, listA, listA2, listB, itemA }) => {
      await client.query(
        `
        update public.item_pricing_base
        set base_cost = base_cost + 125
        where company_id = $1 and item_id = $2
        `,
        [companyA, itemA],
      );

      const pending = await client.query<{ company_id: string; price_list_id: string; item_id: string }>(
        `
        select company_id, price_list_id, item_id
        from public.price_list_items
        where needs_recalculation = true
          and company_id in ($1, $2)
        order by price_list_id, item_id
        `,
        [companyA, companyB],
      );

      expect(pending.rows).toHaveLength(2);
      expect(new Set(pending.rows.map((row) => row.company_id))).toEqual(new Set([companyA]));
      expect(new Set(pending.rows.map((row) => row.item_id))).toEqual(new Set([itemA]));
      expect(new Set(pending.rows.map((row) => row.price_list_id))).toEqual(new Set([listA, listA2]));
      expect(pending.rows.some((row) => row.price_list_id === listB)).toBe(false);
    });
  });

  it("marks only active rows of the affected company and list when its formula really changes", async () => {
    await withMigratedFixture(async ({
      companyA,
      companyB,
      listA,
      listA2,
      listB,
      inactiveItemA,
    }) => {
      await client.query(
        `
        update public.price_lists
        set utilidad_pct = utilidad_pct + 1
        where id = $1 and company_id = $2
        `,
        [listA, companyA],
      );

      const pending = await client.query<{
        company_id: string;
        price_list_id: string;
        item_id: string;
        is_active: boolean;
      }>(
        `
        select company_id, price_list_id, item_id, is_active
        from public.price_list_items
        where needs_recalculation = true
          and company_id in ($1, $2)
        `,
        [companyA, companyB],
      );

      expect(pending.rows).toHaveLength(2);
      expect(pending.rows.every((row) => row.company_id === companyA)).toBe(true);
      expect(pending.rows.every((row) => row.price_list_id === listA)).toBe(true);
      expect(pending.rows.every((row) => row.is_active)).toBe(true);
      expect(pending.rows.some((row) => row.item_id === inactiveItemA)).toBe(false);
      expect(pending.rows.some((row) => row.price_list_id === listA2 || row.price_list_id === listB)).toBe(false);
    });
  });
});
