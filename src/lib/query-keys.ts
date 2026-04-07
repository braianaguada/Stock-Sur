import type { DocStatus, DocType } from "@/features/documents/types";

export const queryKeys = {
  dashboard: {
    itemsCount: (companyId: string | null) => ["items-count", companyId ?? "no-company"] as const,
    suppliersCount: (companyId: string | null) => ["suppliers-count", companyId ?? "no-company"] as const,
    quotesCount: (companyId: string | null) => ["quotes-count", companyId ?? "no-company"] as const,
  },
  customers: {
    list: (companyId: string | null, search: string) => ["customers", companyId ?? "no-company", search] as const,
    all: () => ["customers"] as const,
  },
  items: {
    list: (
      companyId: string | null,
      search: string,
      categoryFilter: string,
      statusFilter: "active" | "inactive" | "all",
      page: number,
      pageSize: number,
      sortBy: string,
      sortDirection: "asc" | "desc",
    ) => ["items", companyId ?? "no-company", search, categoryFilter, statusFilter, page, pageSize, sortBy, sortDirection] as const,
    all: () => ["items"] as const,
    categoriesAll: () => ["items-categories"] as const,
    categories: (companyId: string | null, statusFilter: "active" | "inactive" | "all") =>
      ["items-categories", companyId ?? "no-company", statusFilter] as const,
    aliases: (companyId: string | null, itemId: string | null | undefined) =>
      ["item-aliases", companyId ?? "no-company", itemId] as const,
  },
  cash: {
    customers: (companyId: string | null) => ["cash-customers", companyId ?? "no-company"] as const,
    sales: (companyId: string | null, businessDate: string) => ["cash-sales", companyId ?? "no-company", businessDate] as const,
    remitos: (companyId: string | null, businessDate: string) => ["cash-remitos", companyId ?? "no-company", businessDate] as const,
    closure: (companyId: string | null, businessDate: string) => ["cash-closure", companyId ?? "no-company", businessDate] as const,
    linkedDocument: (documentId: string | null) => ["cash-linked-document", documentId] as const,
    linkedDocumentLines: (documentId: string | null) => ["cash-linked-document-lines", documentId] as const,
    linkedDocumentEvents: (documentId: string | null) => ["cash-linked-document-events", documentId] as const,
    closuresHistory: (companyId: string | null) => ["cash-closures-history", companyId ?? "no-company"] as const,
    closureSales: (companyId: string | null, closureId: string | null) => ["cash-closure-sales", companyId ?? "no-company", closureId] as const,
  },
  documents: {
    customers: (companyId: string | null) => ["documents-customers", companyId ?? "no-company"] as const,
    items: (companyId: string | null) => ["documents-items", companyId ?? "no-company"] as const,
    priceLists: (companyId: string | null) => ["documents-price-lists", companyId ?? "no-company"] as const,
    priceListItems: (companyId: string | null, priceListId: string) => ["documents-price-list-items", companyId ?? "no-company", priceListId] as const,
    priceListItemsAll: () => ["documents-price-list-items"] as const,
    list: (companyId: string | null, search: string, typeFilter: DocType | "ALL", statusFilter: DocStatus | "ALL") =>
      ["documents", companyId ?? "no-company", search, typeFilter, statusFilter] as const,
    all: () => ["documents"] as const,
    lines: (documentId: string | null) => ["document-lines", documentId] as const,
    events: (documentId: string | null) => ["document-events", documentId] as const,
  },
  pending: {
    lines: (companyId: string | null, search: string) => ["pending-lines", companyId ?? "no-company", search] as const,
    linesAll: () => ["pending-lines"] as const,
    itemsSearch: (companyId: string | null, search: string) => ["items-search", companyId ?? "no-company", search] as const,
    itemsSearchAll: () => ["items-search"] as const,
  },
  stock: {
    recentItems: (companyId: string | null, userId: string | null | undefined) =>
      ["stock-recent-items", companyId ?? "no-company", userId ?? "no-user"] as const,
    itemSearch: (companyId: string | null, search: string) =>
      ["stock-item-search", companyId ?? "no-company", search] as const,
    current: (companyId: string | null, search: string) =>
      ["stock-current", companyId ?? "no-company", search] as const,
    allCurrent: () => ["stock-current"] as const,
    movements: (companyId: string | null) => ["stock-movements", companyId ?? "no-company"] as const,
    allMovements: () => ["stock-movements"] as const,
    allRecentItems: () => ["stock-recent-items"] as const,
    allItemSearch: () => ["stock-item-search"] as const,
  },
  pricing: {
    catalogItems: (companyId: string | null) => ["pricing-catalog-items", companyId ?? "no-company"] as const,
    base: (companyId: string | null) => ["pricing-base", companyId ?? "no-company"] as const,
    baseAll: () => ["pricing-base"] as const,
    baseHistory: (companyId: string | null) => ["pricing-base-history", companyId ?? "no-company"] as const,
    baseHistoryAll: () => ["pricing-base-history"] as const,
    lists: (companyId: string | null) => ["price-lists-v2", companyId ?? "no-company"] as const,
    listsAll: () => ["price-lists-v2"] as const,
    listCounts: (companyId: string | null) => ["price-list-counts", companyId ?? "no-company"] as const,
    listCountsAll: () => ["price-list-counts"] as const,
    listProducts: (companyId: string | null, listId: string | null) => ["price-list-products-v2", companyId ?? "no-company", listId] as const,
    listProductsAll: () => ["price-list-products-v2"] as const,
    listHistory: (companyId: string | null, listId: string | null) => ["price-list-history", companyId ?? "no-company", listId] as const,
    listHistoryAll: () => ["price-list-history"] as const,
    userProfiles: (userIds: string[]) => ["pricing-user-profiles", userIds] as const,
  },
  quotes: {
    customers: (companyId: string | null) => ["quotes-customers", companyId ?? "no-company"] as const,
    list: (companyId: string | null, search: string) => ["quotes", companyId ?? "no-company", search] as const,
    all: () => ["quotes"] as const,
    lines: (companyId: string | null, quoteId: string | null) => ["quote-lines", companyId ?? "no-company", quoteId] as const,
    linesAll: () => ["quote-lines"] as const,
  },
  suppliers: {
    list: (companyId: string | null, search: string, statusFilter: "active" | "inactive" | "all") =>
      ["suppliers", companyId ?? "no-company", search, statusFilter] as const,
    listAll: () => ["suppliers"] as const,
    catalogs: (companyId: string | null, supplierId: string | null | undefined) =>
      ["supplier-catalogs", companyId ?? "no-company", supplierId] as const,
    catalogsAll: () => ["supplier-catalogs"] as const,
    catalogVersions: (companyId: string | null, supplierId: string | null | undefined) =>
      ["supplier-catalog-versions", companyId ?? "no-company", supplierId] as const,
    catalogVersionsAll: () => ["supplier-catalog-versions"] as const,
    catalogLines: (companyId: string | null, versionId: string | null, search: string) =>
      ["supplier-catalog-lines", companyId ?? "no-company", versionId, search] as const,
    catalogLinesAll: () => ["supplier-catalog-lines"] as const,
  },
};
