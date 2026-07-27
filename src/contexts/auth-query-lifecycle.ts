import type { Query, QueryClient, QueryKey } from "@tanstack/react-query";

type EffectiveIdentity = {
  actorUserId: string | null;
  effectiveUserId: string | null;
  impersonationId: string | null;
};

export function getEffectiveIdentityKey(identity: EffectiveIdentity) {
  return [
    identity.actorUserId ?? "anonymous",
    identity.effectiveUserId ?? "anonymous",
    identity.impersonationId ?? "self",
  ].join(":");
}

export class EffectiveIdentityTracker {
  private currentKey: string | null = null;

  claim(nextIdentityKey: string) {
    if (this.currentKey === nextIdentityKey) return false;
    this.currentKey = nextIdentityKey;
    return true;
  }
}

export class RequestGeneration {
  private generation = 0;

  next(): number {
    this.generation += 1;
    return this.generation;
  }

  invalidate(): void {
    this.generation += 1;
  }

  isCurrent(candidate: number): boolean {
    return candidate === this.generation;
  }
}

function queryKeyContainsCompany(queryKey: QueryKey, companyId: string): boolean {
  return queryKey.some((part) => {
    if (part === companyId) return true;
    if (Array.isArray(part)) return queryKeyContainsCompany(part, companyId);
    if (part && typeof part === "object") {
      return Object.values(part).some((value) =>
        Array.isArray(value)
          ? queryKeyContainsCompany(value, companyId)
          : value === companyId,
      );
    }
    return false;
  });
}

function isQueryScopedToCompany(query: Pick<Query, "queryKey">, companyId: string) {
  return queryKeyContainsCompany(query.queryKey, companyId);
}

export async function retireIdentityCache(queryClient: QueryClient) {
  await queryClient.cancelQueries();
  queryClient.clear();
}

export async function retireCompanyCache(queryClient: QueryClient, companyId: string | null) {
  if (!companyId) return;

  const predicate = (query: Query) => isQueryScopedToCompany(query, companyId);
  await queryClient.cancelQueries({ predicate });
  queryClient.removeQueries({ predicate });
}
