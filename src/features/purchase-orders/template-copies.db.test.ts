import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/20261017130000_purchase_order_template_copies.sql', 'utf8');

describe('template original and duplicate reservation migration', () => {
  it('allocates one number per sheet atomically with the existing order counter', () => {
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain("'purchase-order-print:' || p_company_id::text");
    expect(sql).toContain('greatest(purchase_order_print_counters.last_number, v_max) + p_sheet_count');
    expect(sql).toContain('returning last_number - p_sheet_count + 1');
    expect(sql).not.toContain('p_sheet_count * 2');
    expect(sql).toContain("'lastNumber', v_first + p_sheet_count - 1");
  });

  it('preserves previous batches and rejects mismatched retries', () => {
    expect(sql).toContain('numbers_per_sheet integer not null default 2');
    expect(sql).toContain('where company_id = p_company_id and request_id = p_request_id');
    expect(sql).toContain('v_sheets <> p_sheet_count or v_numbers_per_sheet <> 1');
    expect(sql).not.toContain('function public.reserve_purchase_order_print_sheets');
  });

  it('retains authenticated active-company membership and effective permission checks', () => {
    for (const fragment of ['auth.uid()', "status = 'ACTIVE'", 'public.is_company_member(v_uid, p_company_id)', "public.has_company_permission(v_uid, p_company_id, 'suppliers.edit')", 'security definer set search_path = public, pg_temp', 'from public, anon', 'to authenticated']) expect(sql).toContain(fragment);
  });
});
