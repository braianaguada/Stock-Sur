import { describe, expect, it } from "vitest";
import { applyDraftExchangeRate } from "./draftExchangeRate";
import { buildInitialServiceDocumentForm } from "./logic";
import type { ExchangeRateSnapshot } from "./exchangeRateProvider";

const snapshot: ExchangeRateSnapshot = { source: "BNA", rate: 1550, rateDate: "2026-10-23", fetchedAt: "2026-10-23T12:00:00Z", label: "BNA vendedor" };

describe("automatic service draft exchange rate", () => {
  it("uses the shared BNA snapshot for a new USD quote", () => {
    const form = { ...buildInitialServiceDocumentForm({}), currency: "USD" as const };
    expect(applyDraftExchangeRate(form, snapshot)).toMatchObject({ exchange_rate: "1550", exchange_rate_source: "BNA", exchange_rate_date: snapshot.rateDate, exchange_rate_fetched_at: snapshot.fetchedAt });
  });

  it("preserves a quote's historical or manual exchange rate", () => {
    const form = { ...buildInitialServiceDocumentForm({}), currency: "USD" as const, exchange_rate: "1200", exchange_rate_source: "MANUAL" as const };
    expect(applyDraftExchangeRate(form, snapshot)).toBe(form);
  });

  it("leaves ARS quotes and invalid rates unchanged", () => {
    const form = buildInitialServiceDocumentForm({});
    expect(applyDraftExchangeRate(form, snapshot)).toBe(form);
    const usd = { ...form, currency: "USD" as const };
    expect(applyDraftExchangeRate(usd, { ...snapshot, rate: NaN })).toBe(usd);
  });
});

