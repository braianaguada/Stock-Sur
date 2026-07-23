type RangeQuery<T> = {
  range: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>;
};

export async function fetchAllPages<T>(createQuery: () => RangeQuery<T>, pageSize = 1000) {
  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await createQuery().range(from, from + pageSize - 1);
    if (error) throw error;

    const page = data ?? [];
    rows.push(...page);

    if (page.length < pageSize) break;
  }

  return rows;
}

export async function fetchAllPagesByChunks<T, TValue>(
  values: TValue[],
  createQuery: (chunk: TValue[]) => RangeQuery<T>,
  chunkSize = 100,
  pageSize = 1000,
) {
  const rows: T[] = [];

  for (let from = 0; from < values.length; from += chunkSize) {
    const chunk = values.slice(from, from + chunkSize);
    rows.push(...await fetchAllPages(() => createQuery(chunk), pageSize));
  }

  return rows;
}
