import { useMemo } from "react";

type UsePaginationSliceParams<TItem> = {
  items: TItem[];
  page: number;
  pageSize: number;
};

export function usePaginationSlice<TItem>({
  items,
  page,
  pageSize,
}: UsePaginationSliceParams<TItem>) {
  return useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const pagedItems = items.slice(start, start + pageSize);
    const rangeStart = items.length === 0 ? 0 : start + 1;
    const rangeEnd = items.length === 0 ? 0 : Math.min(safePage * pageSize, items.length);

    return {
      page: safePage,
      totalPages,
      pagedItems,
      rangeStart,
      rangeEnd,
    };
  }, [items, page, pageSize]);
}
