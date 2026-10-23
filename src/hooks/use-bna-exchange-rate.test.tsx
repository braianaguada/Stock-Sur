import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBnaOfficialUsdRate } from "@/features/services/exchangeRateProvider";
import { useSupplierExchangeRate } from "@/features/suppliers/hooks/useSupplierExchangeRate";
import { useBnaExchangeRate } from "./use-bna-exchange-rate";

vi.mock("@/features/services/exchangeRateProvider", () => ({ fetchBnaOfficialUsdRate: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchBnaOfficialUsdRate).mockResolvedValue({ source: "BNA", rate: 1550, rateDate: "2026-10-23", fetchedAt: "2026-10-23T12:00:00Z", label: "BNA vendedor" });
});

describe("shared BNA quotation", () => {
  it("shares one quotation across suppliers and services, and scopes the cache by company", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result, rerender } = renderHook(({ companyId }) => ({ services: useBnaExchangeRate(companyId), suppliers: useSupplierExchangeRate(companyId) }), { wrapper, initialProps: { companyId: "company-1" } });
    await waitFor(() => expect(result.current.services.isSuccess).toBe(true));
    expect(result.current.services.data).toBe(result.current.suppliers.data);
    expect(fetchBnaOfficialUsdRate).toHaveBeenCalledTimes(1);
    rerender({ companyId: "company-2" });
    expect(result.current.services.data).toBeUndefined();
    await waitFor(() => expect(result.current.services.isSuccess).toBe(true));
    expect(fetchBnaOfficialUsdRate).toHaveBeenCalledTimes(2);
  });

  it("does not fetch without an active company", () => {
    const client = new QueryClient();
    renderHook(() => useBnaExchangeRate(), { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
    expect(fetchBnaOfficialUsdRate).not.toHaveBeenCalled();
  });
});
