import { describe, expect, it } from "vitest";
import { fetchAllPages } from "@/lib/supabase-pagination";

describe("fetchAllPages", () => {
  it("keeps requesting ranges until the last partial page", async () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({ id: index + 1 }));
    const ranges: Array<[number, number]> = [];

    const result = await fetchAllPages(
      () => ({
        range: async (from: number, to: number) => {
          ranges.push([from, to]);
          return { data: rows.slice(from, to + 1), error: null };
        },
      }),
      2,
    );

    expect(result).toEqual(rows);
    expect(ranges).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ]);
  });
});
