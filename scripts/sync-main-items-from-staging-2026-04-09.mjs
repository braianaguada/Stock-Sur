import { Client } from "pg";

const STAGING_DB_URL = process.env.STAGING_DB_URL;
const MAIN_DB_URL = process.env.MAIN_DB_URL;
const STAGING_COMPANY_ID = process.env.STAGING_COMPANY_ID;
const MAIN_COMPANY_ID = process.env.MAIN_COMPANY_ID;

if (!STAGING_DB_URL || !MAIN_DB_URL || !STAGING_COMPANY_ID || !MAIN_COMPANY_ID) {
  console.error("Missing required env vars: STAGING_DB_URL, MAIN_DB_URL, STAGING_COMPANY_ID, MAIN_COMPANY_ID");
  process.exit(1);
}

function createClient(connectionString) {
  return new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
}

async function fetchItems(client, companyId, hasAttributes) {
  const sql = `
    select
      id,
      sku,
      name,
      brand,
      model,
      ${hasAttributes ? "attributes" : "null::text as attributes"},
      unit,
      category,
      demand_profile,
      demand_monthly_estimate,
      supplier,
      is_active
    from public.items
    where company_id = $1
  `;
  const { rows } = await client.query(sql, [companyId]);
  return rows;
}

async function main() {
  const staging = createClient(STAGING_DB_URL);
  const prod = createClient(MAIN_DB_URL);

  await staging.connect();
  await prod.connect();

  await staging.query("set role postgres");
  await prod.query("set role postgres");

  await prod.query("alter table public.items add column if not exists attributes text");

  const [stagingItems, prodItems] = await Promise.all([
    fetchItems(staging, STAGING_COMPANY_ID, true),
    fetchItems(prod, MAIN_COMPANY_ID, true),
  ]);

  const stagingBySku = new Map(stagingItems.map((row) => [row.sku, row]));
  const prodBySku = new Map(prodItems.map((row) => [row.sku, row]));

  const shared = [];
  const stagingOnly = [];
  const prodOnly = [];

  for (const row of stagingItems) {
    if (prodBySku.has(row.sku)) shared.push(row);
    else stagingOnly.push(row);
  }

  for (const row of prodItems) {
    if (!stagingBySku.has(row.sku)) prodOnly.push(row);
  }

  await prod.query("begin");

  try {
    for (const row of shared) {
      await prod.query(
        `
          update public.items
          set
            name = $1,
            brand = $2,
            model = $3,
            attributes = $4,
            unit = $5,
            category = $6,
            demand_profile = $7,
            demand_monthly_estimate = $8,
            is_active = $9
          where company_id = $10 and sku = $11
        `,
        [
          row.name,
          row.brand,
          row.model,
          row.attributes,
          row.unit,
          row.category,
          row.demand_profile,
          row.demand_monthly_estimate,
          row.is_active,
          MAIN_COMPANY_ID,
          row.sku,
        ],
      );
    }

    if (prodOnly.length > 0) {
      await prod.query(
        `
          update public.items
          set is_active = false
          where company_id = $1
            and sku = any($2::text[])
        `,
        [MAIN_COMPANY_ID, prodOnly.map((row) => row.sku)],
      );
    }

    await prod.query("commit");
  } catch (error) {
    await prod.query("rollback");
    throw error;
  } finally {
    await staging.end();
    await prod.end();
  }

  console.log(JSON.stringify({
    shared_by_sku: shared.length,
    staging_only_by_sku: stagingOnly.length,
    main_only_by_sku_deactivated: prodOnly.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
