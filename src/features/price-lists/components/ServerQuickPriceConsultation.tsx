import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query-keys";
import { getErrorMessage } from "@/lib/errors";
import type { PriceListProductRow } from "@/features/price-lists/types";
import { QuickPriceConsultationDialog } from "./QuickPriceConsultationDialog";
import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<typeof QuickPriceConsultationDialog>, "products" | "stockByItemId" | "searchValue" | "onSearchChange" | "page" | "hasMore" | "onPageChange">;
type Result = { items: (PriceListProductRow & { stock: number })[]; hasMore: boolean };

export function ServerQuickPriceConsultation(props: Props) {
  const { currentCompany } = useAuth();
  // Remount search state when changing company, list or reopening the dialog.
  return <PriceSearch key={[currentCompany?.id, props.selectedListId, props.open].join(":")} {...props} companyId={currentCompany?.id ?? null} />;
}

function PriceSearch({ companyId, ...props }: Props & { companyId: string | null }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());
  const enabled = Boolean(props.open && companyId && props.selectedListId && deferredSearch);
  const query = useQuery({
    queryKey: [...queryKeys.pricing.quickSearchAll(), companyId, props.selectedListId, deferredSearch, page],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_quick_prices", {
        p_company_id: companyId!, p_price_list_id: props.selectedListId!, p_search: deferredSearch, p_page: page,
      });
      if (error) throw error;
      return data as unknown as Result;
    },
  });
  const pendingSearch = search.trim() !== deferredSearch;
  const rows = enabled && !pendingSearch ? query.data?.items ?? [] : [];
  return <QuickPriceConsultationDialog {...props}
    products={rows} stockByItemId={new Map(rows.map(row => [row.item_id, row.stock]))}
    searchValue={search} onSearchChange={value => { setSearch(value); setPage(1); }}
    resultsLoading={pendingSearch || (enabled && query.isFetching)}
    resultsError={enabled && query.error ? getErrorMessage(query.error) : null}
    onRetry={() => { void query.refetch(); }} page={page} hasMore={query.data?.hasMore ?? false} onPageChange={setPage}
  />;
}
