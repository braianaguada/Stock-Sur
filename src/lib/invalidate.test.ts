import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import {
  invalidateStockQueries,
  invalidatePricingQueries,
  invalidateSupplierCatalogQueries,
  invalidateSupplierQueries,
  invalidateTechnicianQueries,
} from "@/lib/invalidate";

describe("catalog page freshness", () => {
  it.each([invalidateStockQueries, invalidatePricingQueries])("refreshes visible catalog balances and prices after mutations", async (invalidate) => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    await invalidate({ invalidateQueries } as unknown as QueryClient);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["items-catalog"] });
  });
});

describe("invalidateTechnicianQueries", () => {
  it("invalidates only technician-dependent keys for the affected company", async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const queryClient = { invalidateQueries } as unknown as QueryClient;

    await invalidateTechnicianQueries(queryClient, "company-1");

    expect(invalidateQueries).toHaveBeenCalledTimes(4);
    expect(invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ["technicians", "company-1"],
    });
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ["documents", "technicians", "company-1"],
    });
    expect(invalidateQueries).toHaveBeenNthCalledWith(3, {
      queryKey: ["service-jobs", "company-1"],
    });
    expect(invalidateQueries).toHaveBeenNthCalledWith(4, {
      queryKey: ["service-jobs-technicians", "company-1"],
    });
  });
});

describe("supplier query invalidation", () => {
  it("invalidates only the supplier keys for the affected company", async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const queryClient = { invalidateQueries } as unknown as QueryClient;

    await invalidateSupplierQueries(queryClient, "company-1");

    expect(invalidateQueries).toHaveBeenCalledOnce();
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["suppliers", "company-1"],
    });
  });

  it("invalidates the affected supplier catalog and imported version", async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const queryClient = { invalidateQueries } as unknown as QueryClient;

    await invalidateSupplierCatalogQueries(queryClient, {
      companyId: "company-1",
      supplierId: "supplier-1",
      versionId: "version-1",
    });

    expect(invalidateQueries).toHaveBeenCalledTimes(3);
    expect(invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ["supplier-catalogs", "company-1", "supplier-1"],
    });
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ["supplier-catalog-versions", "company-1", "supplier-1"],
    });
    expect(invalidateQueries).toHaveBeenNthCalledWith(3, {
      queryKey: ["supplier-catalog-lines", "company-1", "version-1"],
    });
  });
});
