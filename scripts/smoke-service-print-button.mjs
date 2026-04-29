import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.addInitScript(() => {
  window.print = () => {
    window.__printCalls = (window.__printCalls || 0) + 1;
  };
});
const page = await context.newPage();
page.on("console", (msg) => console.log("console:", msg.type(), msg.text()));
page.on("pageerror", (err) => console.log("pageerror:", err.message));

await page.route("**/auth/v1/token?grant_type=refresh_token", async (route) => {
  await route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      access_token: "smoke-token",
      refresh_token: "smoke-refresh",
      token_type: "bearer",
      expires_in: 3600,
      user: { id: "user-1", email: "smoke@stocksur.local", aud: "authenticated", role: "authenticated" },
    }),
  });
});

await page.route("**/rest/v1/**", async (route) => {
  const url = route.request().url();
  let data = [];

  if (url.includes("/user_roles")) data = [{ role: "user" }];
  if (url.includes("/company_users")) data = [{ id: "company-user-1", company_id: "company-1" }];
  if (url.includes("/companies")) data = [{ id: "company-1", name: "Stock Sur", slug: "stock-sur", status: "ACTIVE" }];
  if (url.includes("/customers")) data = [{ id: "customer-1", name: "Cliente Smoke", cuit: "20-00000000-0", email: null, phone: null }];
  if (url.includes("/service_documents")) {
    data = {
      id: "doc-1",
      company_id: "company-1",
      customer_id: "customer-1",
      customers: { id: "customer-1", name: "Cliente Smoke", cuit: "20-00000000-0", email: null, phone: null },
      type: "QUOTE",
      status: "DRAFT",
      number: 7,
      reference: "Smoke print",
      issue_date: "2026-04-29",
      valid_until: null,
      delivery_time: "48 hs",
      payment_terms: "Contado",
      delivery_location: "Taller",
      intro_text: "Trabajo de prueba",
      closing_text: "Gracias",
      subtotal: 1234,
      total: 1234,
      currency: "ARS",
      created_at: "2026-04-29T12:00:00Z",
      created_by: "user-1",
    };
    if (!route.request().headers().accept?.includes("vnd.pgrst.object")) data = [data];
  }
  if (url.includes("/service_document_lines")) {
    data = [{ id: "line-1", document_id: "doc-1", description: "Linea smoke", quantity: 1, unit: "u", unit_price: 1234, line_total: 1234, sort_order: 1 }];
  }
  if (url.includes("/company_user_roles") || url.includes("/company_user_permissions") || url.includes("/roles") || url.includes("/permissions")) data = [];

  await route.fulfill({ contentType: "application/json", body: JSON.stringify(data) });
});

await page.addInitScript(() => {
  window.__STOCK_SUR_PRINT_SMOKE__ = true;
  window.__STOCK_SUR_PRINT_CALLED__ = 0;
  localStorage.setItem("sb-tihjnbfdjnjobxxecuaz-auth-token", JSON.stringify({
    access_token: "smoke-token",
    refresh_token: "smoke-refresh",
    token_type: "bearer",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    user: { id: "user-1", email: "smoke@stocksur.local", aud: "authenticated", role: "authenticated" },
  }));
  localStorage.setItem("stock-sur.current-company-id", "company-1");
});

let popupPrintCalls = 0;
await page.goto("http://127.0.0.1:5173/services/documents", { waitUntil: "networkidle" });
console.log("main body before click:", (await page.locator("body").innerText()).slice(0, 1000));
const popupPromise = page.waitForEvent("popup");
await page.getByTitle("Imprimir").first().click();
const popup = await popupPromise;
await popup.waitForFunction(() => document.body?.innerText.includes("Presupuesto de servicio"), null, { timeout: 10000 });
await popup.waitForTimeout(700);
popupPrintCalls = await page.evaluate(() => window.__STOCK_SUR_PRINT_CALLED__ || 0);
const popupText = await popup.locator("body").innerText();

console.log(JSON.stringify({
  pageUrl: page.url(),
  popupUrl: popup.url(),
  hasPrintableDocument: popupText.includes("SERV-000007") && popupText.includes("Linea smoke"),
  popupPrintCalls,
}, null, 2));

await browser.close();
