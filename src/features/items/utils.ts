import { cleanText } from "@/lib/clean";

// Empty codes are assigned atomically by PostgreSQL, never by the browser.
export function validateItemCode(value: string) {
  const code = cleanText(value);
  if (code && !/^[0-9]+$/.test(code)) throw new Error("El codigo debe contener solo numeros. Dejalo vacio para asignarlo automaticamente.");
  return code;
}
