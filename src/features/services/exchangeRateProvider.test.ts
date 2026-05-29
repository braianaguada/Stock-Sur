import { describe, expect, it, vi } from "vitest";
import { normalizeBnaRatePayload, parseBnaHtmlUsdSellRate } from "./exchangeRateProvider";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe("exchangeRateProvider", () => {
  it("parses the BNA USD sell rate from the html table", () => {
    const html = `
      <div id="cotizacionesCercanas">Fecha: 28/5/2026</div>
      <table>
        <tr><td>Euro</td><td>1594.0000</td><td>1603.0000</td></tr>
        <tr><td>Dolar U.S.A</td><td class="dest">1401.0000</td><td class="dest">1410.0000</td></tr>
      </table>
    `;

    expect(parseBnaHtmlUsdSellRate(html)).toEqual({
      rate: 1410,
      rateDate: "2026-05-28",
    });
  });

  it("parses the current BNA homepage bill rate before historical tables", () => {
    const html = `
      <table class="table cotizacion">
        <thead>
          <tr><th class="fechaCot">28/5/2026</th><th>Compra</th><th>Venta</th></tr>
        </thead>
        <tbody>
          <tr><td class="tit">Dolar U.S.A</td><td>1380,00</td><td>1430,00</td></tr>
        </tbody>
      </table>
      <table>
        <tr><td>Dolar U.S.A</td><td>1401.0000</td><td>1410.0000</td></tr>
      </table>
    `;

    expect(parseBnaHtmlUsdSellRate(html)).toEqual({
      rate: 1430,
      rateDate: "2026-05-28",
    });
  });

  it("normalizes edge function payloads", () => {
    expect(normalizeBnaRatePayload({ rate: "1.410,50", rateDate: "2026-05-28" })).toEqual({
      rate: 1410.5,
      rateDate: "2026-05-28",
    });
  });
});
