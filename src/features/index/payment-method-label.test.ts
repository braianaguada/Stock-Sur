import { describe, expect, it } from "vitest";
import { formatDashboardPaymentMethod } from "@/features/index/payment-method-label";

describe("formatDashboardPaymentMethod", () => {
  it("presenta servicios_remito como una etiqueta operativa legible", () => {
    expect(formatDashboardPaymentMethod("servicios_remito")).toBe("Servicios / remito");
    expect(formatDashboardPaymentMethod(" SERVICIOS_REMITO ")).toBe("Servicios / remito");
  });

  it("normaliza métodos conocidos sin depender de mayúsculas", () => {
    expect(formatDashboardPaymentMethod("transferencia")).toBe("Transferencia");
    expect(formatDashboardPaymentMethod("cuenta_corriente")).toBe("Cuenta corriente");
  });

  it("evita exponer identificadores técnicos desconocidos o vacíos", () => {
    expect(formatDashboardPaymentMethod("MERCADO_PAGO")).toBe("Mercado pago");
    expect(formatDashboardPaymentMethod("")).toBe("Sin medio informado");
  });
});
