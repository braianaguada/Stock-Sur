import { describe, expect, expectTypeOf, it, vi } from "vitest";
import type { Tables } from "@/integrations/supabase/types";
import { useCustomerAccountCustomers } from "./useCustomerAccountCustomers";

const mocks = vi.hoisted(() => ({ from: vi.fn(), query: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("@tanstack/react-query", () => ({ useQuery: (options: unknown) => { mocks.query(options); return {}; } }));

describe("account customers query", () => {
  it("retains typed payment terms and isolates the paginated query by company", async () => {
    const rows = [{ id: "client-1", name: "Cliente", account_due_days: 45 }];
    const builder = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn().mockResolvedValue({ data: rows, error: null }) };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    mocks.from.mockReturnValue(builder);
    useCustomerAccountCustomers("company-1");
    const options = mocks.query.mock.calls.at(-1)![0] as { queryFn: () => Promise<unknown>; queryKey: unknown[] };
    expect(await options.queryFn()).toEqual(rows);
    expect(builder.eq).toHaveBeenCalledWith("company_id", "company-1");
    expect(builder.eq).toHaveBeenCalledWith("is_occasional", false);
    expect(options.queryKey).toContain("company-1");
    expectTypeOf<Tables<"customers">["account_due_days"]>().toEqualTypeOf<number>();
    type Customer = NonNullable<ReturnType<typeof useCustomerAccountCustomers>["data"]>[number];
    expectTypeOf<Customer["account_due_days"]>().toEqualTypeOf<number>();
  });
});
