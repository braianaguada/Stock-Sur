import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptServiceDocumentAiSuggestion,
  fetchActiveServiceDocumentShareLink,
  fetchServiceDocumentPrintResources,
} from "./api";

const { fromMock, storageFromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  storageFromMock: vi.fn(),
}));

vi.mock("./db", () => ({
  serviceDb: {
    from: fromMock,
    rpc: vi.fn(),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: storageFromMock,
    },
  },
}));

type QueryResult = { data: unknown; error: Error | null };

function queryBuilder(result: QueryResult) {
  const builder = {
    select: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    then: undefined as Promise<QueryResult>["then"] | undefined,
  };
  builder.select.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockResolvedValue(result);
  builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

describe("services api", () => {
  beforeEach(() => {
    fromMock.mockReset();
    storageFromMock.mockReset();
  });

  it("scopes printable lines through the document RLS and attachments to the active company", async () => {
    const lines = queryBuilder({
      data: [{ id: "line-1", document_id: "doc-1" }],
      error: null,
    });
    const attachments = queryBuilder({
      data: [{
        id: "attachment-1",
        service_document_id: "doc-1",
        storage_bucket: "service-documents",
        storage_path: "company-1/doc-1/file.pdf",
      }],
      error: null,
    });
    fromMock
      .mockReturnValueOnce(lines)
      .mockReturnValueOnce(attachments);
    storageFromMock.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: "https://signed.example/file.pdf" },
        error: null,
      }),
    });

    const result = await fetchServiceDocumentPrintResources("company-1", "doc-1");

    expect(lines.eq).not.toHaveBeenCalledWith("company_id", expect.anything());
    expect(lines.eq).toHaveBeenCalledWith("document_id", "doc-1");
    expect(attachments.eq).toHaveBeenCalledWith("company_id", "company-1");
    expect(attachments.eq).toHaveBeenCalledWith("service_document_id", "doc-1");
    expect(result.attachments[0]?.signed_url).toBe("https://signed.example/file.pdf");
  });

  it("scopes AI suggestion acceptance to the active company", async () => {
    const suggestions = queryBuilder({ data: null, error: null });
    fromMock.mockReturnValue(suggestions);

    await acceptServiceDocumentAiSuggestion({
      companyId: "company-1",
      suggestionId: "suggestion-1",
      documentId: "doc-1",
    });

    expect(suggestions.eq).toHaveBeenNthCalledWith(1, "company_id", "company-1");
    expect(suggestions.eq).toHaveBeenNthCalledWith(2, "id", "suggestion-1");
  });

  it("scopes the active share link lookup to company and document", async () => {
    const links = queryBuilder({
      data: [{ id: "link-1", token: "token-1" }],
      error: null,
    });
    fromMock.mockReturnValue(links);

    await fetchActiveServiceDocumentShareLink("company-1", "doc-1");

    expect(links.eq).toHaveBeenCalledWith("company_id", "company-1");
    expect(links.eq).toHaveBeenCalledWith("service_document_id", "doc-1");
    expect(links.eq).toHaveBeenCalledWith("enabled", true);
  });

  it("rejects access when there is no active company", async () => {
    await expect(fetchServiceDocumentPrintResources(null, "doc-1"))
      .rejects.toThrow("Selecciona una empresa");
    expect(fromMock).not.toHaveBeenCalled();
  });
});
