import { describe, expect, it } from "vitest";
import { purchaseOrderActions } from "@/features/purchase-orders/types";

describe("purchaseOrderActions", () => {
  it("permite editar y eliminar solamente borradores", () => {
    expect(purchaseOrderActions("DRAFT")).toMatchObject({ canEdit: true, canDelete: true });
    expect(purchaseOrderActions("SENT")).toMatchObject({ canEdit: false, canDelete: false });
  });

  it("no ofrece acciones operativas para ordenes terminales", () => {
    expect(purchaseOrderActions("CANCELLED")).toEqual({
      canEdit: false, canDelete: false, canSend: false, canCancel: false,
    });
  });
});
