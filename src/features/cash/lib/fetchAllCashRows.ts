type CashPageResult<T> = {
  data: T[] | null;
  error: unknown;
  count: number | null;
};

type CashPageFetcher<T> = (
  from: number,
  to: number,
) => PromiseLike<CashPageResult<T>>;

export const CASH_TOTALS_PAGE_SIZE = 1000;

export async function fetchAllCashRows<T extends { id: string }>(
  fetchPage: CashPageFetcher<T>,
  pageSize = CASH_TOTALS_PAGE_SIZE,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error("El tamaño de página para Totales de Caja debe ser un entero positivo.");
  }

  const rows: T[] = [];
  const rowIds = new Set<string>();

  while (true) {
    const from = rows.length;
    const { data, error, count } = await fetchPage(from, from + pageSize - 1);

    if (error) throw error;
    if (count === null) {
      throw new Error("No se pudo verificar la cantidad completa de movimientos de Caja.");
    }

    const page = data ?? [];
    if (page.length === 0) {
      if (rows.length === count) return rows;
      if (rows.length > count) {
        throw new Error("Los movimientos de Caja cambiaron durante la consulta. Volvé a intentarlo.");
      }
      throw new Error("La consulta de Totales de Caja quedó incompleta. Volvé a intentarlo.");
    }

    for (const row of page) {
      if (rowIds.has(row.id)) {
        throw new Error("Los movimientos de Caja cambiaron durante la consulta. Volvé a intentarlo.");
      }
      rowIds.add(row.id);
      rows.push(row);
    }

    if (rows.length > count) {
      throw new Error("Los movimientos de Caja cambiaron durante la consulta. Volvé a intentarlo.");
    }
    if (rows.length === count) return rows;
  }
}
