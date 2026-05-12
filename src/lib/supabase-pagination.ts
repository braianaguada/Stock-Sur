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
