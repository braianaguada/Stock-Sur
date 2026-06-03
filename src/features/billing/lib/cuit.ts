export function normalizeCuit(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidCuitFormat(value: string) {
  return normalizeCuit(value).length === 11;
}
