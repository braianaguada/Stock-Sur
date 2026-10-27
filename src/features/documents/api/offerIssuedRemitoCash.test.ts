import { beforeEach, describe, expect, it, vi } from "vitest";
import { offerIssuedRemitoCash } from "./offerIssuedRemitoCash";

const { from, eq, maybeSingle } = vi.hoisted(() => ({ from: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));

beforeEach(() => {
  vi.clearAllMocks();
  eq.mockReturnValue({ eq, maybeSingle });
  from.mockReturnValue({ select: () => ({ eq }) });
});

describe("offerIssuedRemitoCash", () => {
  const setup = () => ({ companyId: "company", documentId: "doc", canRegister: true, isCurrentCompany: vi.fn(() => true), onOpen: vi.fn(), onError: vi.fn() });

  it.each(["INTERNO", "GENERAL"])("offers Caja after issuing a %s remito", async (customer_kind) => {
    const document = { id: "doc", doc_type: "REMITO", customer_kind };
    maybeSingle.mockResolvedValue({ data: document, error: null });
    const options = setup();
    await offerIssuedRemitoCash(options);
    expect(eq.mock.calls).toEqual([["company_id", "company"], ["id", "doc"], ["status", "EMITIDO"]]);
    expect(options.onOpen).toHaveBeenCalledWith(document);
  });

  it("does not load without cash permission", async () => {
    await offerIssuedRemitoCash({ ...setup(), canRegister: false });
    expect(from).not.toHaveBeenCalled();
  });

  it("discards a response after changing company", async () => {
    maybeSingle.mockResolvedValue({ data: { doc_type: "REMITO", customer_kind: "INTERNO" }, error: null });
    const options = setup();
    options.isCurrentCompany.mockReturnValueOnce(true).mockReturnValueOnce(false);
    await offerIssuedRemitoCash(options);
    expect(options.onOpen).not.toHaveBeenCalled();
  });

  it("offers a retry through document actions on read failure", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: new Error("read failed") });
    const options = setup();
    await offerIssuedRemitoCash(options);
    expect(options.onError).toHaveBeenCalledOnce();
    expect(options.onOpen).not.toHaveBeenCalled();
  });
});
