const PAYMENT_METHOD_LABELS: Record<string, string> = {
  EFECTIVO: "Efectivo",
  EFECTIVO_REMITO: "Efectivo remito",
  EFECTIVO_FACTURABLE: "Efectivo facturable",
  SERVICIOS_REMITO: "Servicios / remito",
  POINT: "Point",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
  CUENTA_CORRIENTE: "Cuenta corriente",
};

export function formatDashboardPaymentMethod(method: string): string {
  const normalized = method.trim().toUpperCase();

  if (!normalized) {
    return "Sin medio informado";
  }

  const knownLabel = PAYMENT_METHOD_LABELS[normalized];
  if (knownLabel) {
    return knownLabel;
  }

  const readableLabel = normalized.replace(/_+/g, " ").toLocaleLowerCase("es-AR");
  return readableLabel.charAt(0).toLocaleUpperCase("es-AR") + readableLabel.slice(1);
}
