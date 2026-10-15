import { describe, expect, it } from "vitest";
import { DEFAULT_COMPANY_SETTINGS } from "@/contexts/company-brand-context";
import { buildPurchaseOrderModelHtml } from "./print-model";

describe("purchase order blank print model", () => {
  it("prints two distinct numbered forms side by side on A4 landscape", () => {
    const html = buildPurchaseOrderModelHtml(DEFAULT_COMPANY_SETTINGS, { firstNumber: 31, secondNumber: 32 }, "15/10/2026");
    const dom = new DOMParser().parseFromString(html, "text/html");
    expect(dom.querySelectorAll("article.order")).toHaveLength(2);
    expect(dom.querySelectorAll("tbody tr")).toHaveLength(24);
    expect(html).toContain("@page{size:A4 landscape;margin:0}");
    expect(html).toContain("grid-template-columns:1fr 1fr");
    expect(html).toContain("N° 00000031");
    expect(html).toContain("N° 00000032");
    expect(dom.body.textContent).toContain("CUIT 30-71158289-0");
    for (const field of ["Proveedor", "Domicilio", "Condición de compra", "Retira", "Referencia", "Autorizado por", "Preparado por"]) expect(dom.body.textContent).toContain(field);
  });
  it("fills the entire sheet with two equal bordered halves without outer margins or a gap", () => {
    const html = buildPurchaseOrderModelHtml(DEFAULT_COMPANY_SETTINGS, { firstNumber: 1, secondNumber: 2 }, "15/10/2026");
    const dom = new DOMParser().parseFromString(html, "text/html");
    const style = document.createElement("style");
    style.textContent = dom.querySelector("style")!.textContent;
    document.head.append(style);
    try {
      const rules = Array.from(style.sheet!.cssRules) as CSSStyleRule[];
      const page = rules.find(rule => rule.selectorText === ".page")!.style;
      const order = rules.find(rule => rule.selectorText === ".order")!.style;
      expect(page.width).toBe("297mm");
      expect(page.height).toBe("210mm");
      expect(page.gap).toBe("0");
      expect(order.width).toBe("148.5mm");
      expect(order.height).toBe("210mm");
      expect(order.border).toBe("1px solid #334155");
      expect(order.padding).toBe("4mm");
      expect(rules.find(rule => rule.selectorText === "*")!.style.getPropertyValue("box-sizing")).toBe("border-box");
    } finally {
      style.remove();
    }
  });
  it("uses company identity, escapes fields and rejects executable logo URLs", () => {
    const html = buildPurchaseOrderModelHtml({ ...DEFAULT_COMPANY_SETTINGS, legal_name: '<script>alert("x")</script>', address: "Mi dirección", email: "compras@example.test", logo_url: "javascript:alert(1)", tax_id: "OTRO CUIT" }, { firstNumber: 1, secondNumber: 2 }, "15/10/2026");
    const dom = new DOMParser().parseFromString(html, "text/html");
    expect(dom.querySelector("script")).toBeNull();
    expect(dom.querySelector("img")).toBeNull();
    expect(dom.body.textContent).toContain('alert("x")');
    expect(dom.body.textContent).toContain("Mi dirección");
    expect(dom.body.textContent).toContain("compras@example.test");
    expect(dom.body.textContent).not.toContain("OTRO CUIT");
  });
  it("includes the configured company logo twice", () => {
    const html = buildPurchaseOrderModelHtml({ ...DEFAULT_COMPANY_SETTINGS, logo_url: "https://example.test/logo.png" }, { firstNumber: 1, secondNumber: 2 }, "15/10/2026");
    expect(new DOMParser().parseFromString(html, "text/html").querySelectorAll('img[src="https://example.test/logo.png"]')).toHaveLength(2);
  });
});
