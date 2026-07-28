import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

export async function invalidateItemQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.items.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.items.categoriesAll() }),
    queryClient.invalidateQueries({ queryKey: ["items-catalog"] }),
    queryClient.invalidateQueries({ queryKey: ["items-search-aliases"] }),
    queryClient.invalidateQueries({ queryKey: ["items-count"] }),
  ]);
}

export async function invalidateCustomerQueries(queryClient: QueryClient) {
  await queryClient.invalidateQueries({ queryKey: queryKeys.customers.all() });
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["customer-account-summary"] }),
    queryClient.invalidateQueries({ queryKey: ["customer-account-entries"] }),
  ]);
}

export async function invalidateTechnicianQueries(queryClient: QueryClient, companyId: string | null) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.technicians.company(companyId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.documents.technicians(companyId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.serviceJobs.company(companyId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.serviceJobs.technicians(companyId) }),
  ]);
}

export async function invalidateDocumentQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.documents.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.documents.priceListItemsAll() }),
  ]);
}

export async function invalidateStockQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.stock.allCurrent() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.stock.allMovements() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.stock.allRecentItems() }),
    queryClient.invalidateQueries({ queryKey: ["items-stock-totals"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] }),
  ]);
}

export async function invalidatePricingQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.pricing.catalogItemsAll() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.pricing.baseAll() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.pricing.baseHistoryAll() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.pricing.listCountsAll() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.pricing.listsAll() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.pricing.listProductsAll() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.pricing.listHistoryAll() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.documents.priceListItemsAll() }),
  ]);
}

export async function invalidateSupplierQueries(
  queryClient: QueryClient,
  companyId: string,
) {
  await queryClient.invalidateQueries({
    queryKey: queryKeys.suppliers.company(companyId),
  });
}

export async function invalidateSupplierCatalogQueries(
  queryClient: QueryClient,
  params: {
    companyId: string;
    supplierId: string;
    versionId?: string | null;
  },
) {
  const invalidations = [
    queryClient.invalidateQueries({
      queryKey: queryKeys.suppliers.catalogs(params.companyId, params.supplierId),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.suppliers.catalogVersions(params.companyId, params.supplierId),
    }),
  ];

  if (params.versionId) {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: queryKeys.suppliers.catalogLinesVersion(params.companyId, params.versionId),
      }),
    );
  }

  await Promise.all(invalidations);
}

export async function invalidateQuoteQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.quotes.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.quotes.linesAll() }),
  ]);
}
