import { useDeferredValue, useState } from "react";

export type SearchScope = "items" | "customers" | "suppliers" | "documents";

export function useSearch(initialValue = "") {
  const [search, setSearch] = useState(initialValue);
  const deferredSearch = useDeferredValue(search);

  return {
    search,
    deferredSearch,
    setSearch,
    trimmedSearch: deferredSearch.trim(),
  };
}

