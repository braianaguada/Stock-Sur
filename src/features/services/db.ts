import { supabase } from "@/integrations/supabase/client";

type QueryResult<T> = Promise<{ data: T | null; error: Error | null }>;

export type UntypedQueryBuilder = {
  select: (columns?: string, options?: Record<string, unknown>) => UntypedQueryBuilder;
  eq: (column: string, value: unknown) => UntypedQueryBuilder;
  order: (column: string, options?: Record<string, unknown>) => UntypedQueryBuilder;
  limit: (count: number) => QueryResult<unknown[]>;
  single: () => QueryResult<unknown>;
  insert: (payload: unknown) => UntypedQueryBuilder;
  update: (payload: unknown) => UntypedQueryBuilder;
  delete: () => UntypedQueryBuilder;
};

type RpcResult<T> = Promise<{ data: T | null; error: Error | null }>;

type UntypedSupabase = {
  from: (table: string) => UntypedQueryBuilder;
  rpc: (fn: string, params?: Record<string, unknown>) => RpcResult<unknown>;
};

export const serviceDb = supabase as unknown as UntypedSupabase;
