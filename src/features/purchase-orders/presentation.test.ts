import { describe, expect, it } from "vitest";
import { PURCHASE_ORDER_STATUS_LABELS, PURCHASE_ORDER_STATUS_TONES } from "./presentation";

describe("purchase order presentation", () => {
  it("keeps status copy and semantic tones in one mapping", () => {
    expect(PURCHASE_ORDER_STATUS_LABELS).toEqual({
      DRAFT: "Borrador",
      SENT: "Enviada",
      CANCELLED: "Cancelada",
    });
    expect(PURCHASE_ORDER_STATUS_TONES).toEqual({
      DRAFT: "muted",
      SENT: "info",
      CANCELLED: "danger",
    });
  });
});
