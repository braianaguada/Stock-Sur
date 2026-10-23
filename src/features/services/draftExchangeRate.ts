import type { ExchangeRateSnapshot } from "./exchangeRateProvider";
import type { ServiceDocumentForm } from "./types";

export function applyDraftExchangeRate(form: ServiceDocumentForm, snapshot: ExchangeRateSnapshot): ServiceDocumentForm {
  if (form.currency !== "USD" || Number(form.exchange_rate) > 0 || !Number.isFinite(snapshot.rate) || snapshot.rate <= 0) return form;
  return {
    ...form,
    exchange_rate: String(snapshot.rate),
    exchange_rate_source: snapshot.source,
    exchange_rate_date: snapshot.rateDate,
    exchange_rate_fetched_at: snapshot.fetchedAt,
    exchange_rate_snapshot_label: snapshot.label,
  };
}
