export const currency = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
});

export function formatMoney(value: number) {
  return value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const AR_TIME_ZONE = "America/Argentina/Buenos_Aires";

export function formatTime(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: AR_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDateTime(value: string | null) {
  if (!value) return "Abierto";

  return new Intl.DateTimeFormat("es-AR", {
    timeZone: AR_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatBusinessDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function businessDateFromTimestamp(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: AR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return value.slice(0, 10);
  return `${year}-${month}-${day}`;
}

export function monthKeyFromTimestamp(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: AR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(value));

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) return value.slice(0, 7);
  return `${year}-${month}`;
}

export function currentTimeInBuenosAires() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: AR_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? NaN);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? NaN);
  return { hour, minute };
}

export function todayBusinessDateInputValue() {
  return businessDateFromTimestamp(new Date().toISOString());
}

export function formatTimestampDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: AR_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function formatTimestampTime(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: AR_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDocumentNumber(pointOfSale: number, documentNumber: number | null) {
  if (documentNumber == null) return "Sin numero";
  return `${String(pointOfSale).padStart(4, "0")}-${String(documentNumber).padStart(8, "0")}`;
}
