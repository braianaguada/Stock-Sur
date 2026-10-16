import { afterEach, describe, expect, it, vi } from "vitest";
import handler, { sanitizeFileName, sanitizeHtml } from "../../api/render-pdf";

describe("render PDF helpers", () => {
  it("removes active and embedded content from printable HTML", () => {
    const html = '<html><body onload="attack()"><script>attack()</script><iframe src="https://example.com"></iframe><embed src="file"></body></html>';
    const sanitized = sanitizeHtml(html);

    expect(sanitized).not.toContain("script");
    expect(sanitized).not.toContain("iframe");
    expect(sanitized).not.toContain("embed");
    expect(sanitized).not.toContain("onload");
  });

  it("returns a safe PDF filename", () => {
    expect(sanitizeFileName('Presupuesto: 12/3?.PDF')).toBe("Presupuesto- 12-3-.pdf");
  });
});


describe('purchase order PDF authorization', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  const response = () => { const r = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn(), send: vi.fn() }; r.status.mockReturnValue(r); r.json.mockReturnValue(r); return r; };
  it('rejects public purchase order proofs', async () => {
    const r = response();
    await handler({ method: 'POST', headers: {}, body: { html: '<html>Order</html>', proof: { mode: 'public', kind: 'purchase_order', token: 'un-token-largo-no-publico' } } }, r);
    expect(r.status).toHaveBeenCalledWith(400);
  });
  it('requires authentication for purchase orders', async () => {
    const r = response();
    await handler({ method: 'POST', headers: {}, body: { html: '<html>Order</html>', proof: { mode: 'authenticated', kind: 'purchase_order', documentId: 'order-id' } } }, r);
    expect(r.status).toHaveBeenCalledWith(403);
  });
  it('uses the user token and rejects an order hidden by RLS', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://qa.example.test'); vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon');
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: true, json: async () => [] }); vi.stubGlobal('fetch', fetcher);
    const r = response();
    await handler({ method: 'POST', headers: { authorization: 'Bearer test-user' }, body: { html: '<html>Order</html>', proof: { mode: 'authenticated', kind: 'purchase_order', documentId: 'foreign-order' } } }, r);
    expect(fetcher).toHaveBeenLastCalledWith('https://qa.example.test/rest/v1/supplier_purchase_orders?id=eq.foreign-order&select=id&limit=1', { headers: { apikey: 'test-anon', authorization: 'Bearer test-user' } });
    expect(r.status).toHaveBeenCalledWith(403);
  });
});
