import { describe, expect, it } from "vitest";
import { SERVICE_STATUS_LABEL, SERVICE_STATUS_TONE } from "./constants";

describe("service document presentation", () => {
  it("shares labels and semantic tones across list and preview", () => {
    expect(SERVICE_STATUS_LABEL).toEqual({
      DRAFT: "Borrador",
      SENT: "Enviado",
      APPROVED: "Aprobado",
      REJECTED: "Rechazado",
      CANCELLED: "Anulado",
    });
    expect(SERVICE_STATUS_TONE).toEqual({
      DRAFT: "muted",
      SENT: "info",
      APPROVED: "success",
      REJECTED: "danger",
      CANCELLED: "danger",
    });
  });
});
