import { describe, expect, it } from "vitest";
import { fetchAllPages, fetchAllPagesByChunks } from "@/lib/supabase-pagination";

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

  it("paginates every bounded value chunk", async () => {
    const values = ["a", "b", "c", "d", "e"];
    const chunks: string[][] = [];
    const ranges: Array<[number, number]> = [];

    const result = await fetchAllPagesByChunks(
      values,
      (chunk) => {
        chunks.push(chunk);
        const rows = chunk.flatMap((value) => [
          `${value}-1`,
          `${value}-2`,
          `${value}-3`,
        ]);
        return {
          range: async (from: number, to: number) => {
            ranges.push([from, to]);
            return { data: rows.slice(from, to + 1), error: null };
          },
        };
      },
      2,
      4,
    );

    expect(result).toEqual([
      "a-1", "a-2", "a-3",
      "b-1", "b-2", "b-3",
      "c-1", "c-2", "c-3",
      "d-1", "d-2", "d-3",
      "e-1", "e-2", "e-3",
    ]);
    expect(chunks).toEqual([
      ["a", "b"], ["a", "b"],
      ["c", "d"], ["c", "d"],
      ["e"],
    ]);
    expect(ranges).toEqual([
      [0, 3], [4, 7],
      [0, 3], [4, 7],
      [0, 3],
    ]);
  });

  it("does not create a query for an empty value list", async () => {
    let calls = 0;
    const result = await fetchAllPagesByChunks([], () => {
      calls += 1;
      return { range: async () => ({ data: [], error: null }) };
    });

    expect(result).toEqual([]);
    expect(calls).toBe(0);
  });
});
