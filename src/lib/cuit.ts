export function normalizeCuit(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

export function isValidCuitFormat(value: string | null | undefined) {
  return normalizeCuit(value).length === 11;
}

export function isValidCuitChecksum(value: string | null | undefined) {
  const digits = normalizeCuit(value);
  if (digits.length !== 11) return false;

  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, weight, index) => acc + Number(digits[index]) * weight, 0);
  const mod = sum % 11;
  const verifier = mod === 0 ? 0 : mod === 1 ? 9 : 11 - mod;

  return verifier === Number(digits[10]);
}
