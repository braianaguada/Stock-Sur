export const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

export function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(value: string | null) {
  if (!value) return "Abierto";

  return new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatBusinessDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function formatIsoDate(value: string) {
  return formatBusinessDate(value);
}

export function formatDocumentNumber(pointOfSale: number, documentNumber: number | null) {
  if (documentNumber == null) return "Sin numero";
  return `${String(pointOfSale).padStart(4, "0")}-${String(documentNumber).padStart(8, "0")}`;
}
