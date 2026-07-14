import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildSupplierComparisonGroups, normalizeComparisonSearch } from "@/features/suppliers/comparison/domain";
import { fetchSupplierComparisonOffers, fetchSupplierComparisonVersions } from "@/features/suppliers/comparison/queries";

export function useSupplierComparison(companyId: string | null, versionIds: string[], search: string, usdToArs: number | null) {
  const versionsQuery = useQuery({
    queryKey: ["supplier-comparison", "versions", companyId],
    queryFn: () => fetchSupplierComparisonVersions(companyId!),
    enabled: Boolean(companyId),
  });
  const selectedVersions = useMemo(() => {
    const selected = new Set(versionIds);
    return (versionsQuery.data ?? []).filter((version) => selected.has(version.id));
  }, [versionIds, versionsQuery.data]);
  const offersQuery = useQuery({
    queryKey: ["supplier-comparison", "offers", companyId, [...versionIds].sort(), normalizeComparisonSearch(search)],
    queryFn: () => fetchSupplierComparisonOffers(companyId!, selectedVersions, search),
    enabled: Boolean(companyId) && selectedVersions.length > 0 && normalizeComparisonSearch(search).length >= 2,
  });
  const groups = useMemo(
    () => buildSupplierComparisonGroups(offersQuery.data ?? [], usdToArs),
    [offersQuery.data, usdToArs],
  );
  return { versionsQuery, offersQuery, groups };
}

