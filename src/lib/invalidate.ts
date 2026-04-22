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
    queryClient.invalidateQueries({ queryKey: queryKeys.stock.allItemSearch() }),
    queryClient.invalidateQueries({ queryKey: ["items-stock-totals"] }),
    queryClient.invalidateQueries({ queryKey: ["stock-ai-alerts"] }),
  ]);
}

export async function invalidatePricingQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.pricing.baseAll() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.pricing.baseHistoryAll() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.pricing.listCountsAll() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.pricing.listsAll() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.pricing.listProductsAll() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.pricing.listHistoryAll() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.documents.priceListItemsAll() }),
  ]);
}

export async function invalidateSupplierQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.listAll() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.catalogsAll() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.catalogVersionsAll() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.catalogLinesAll() }),
  ]);
}

export async function invalidateQuoteQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.quotes.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.quotes.linesAll() }),
  ]);
}
