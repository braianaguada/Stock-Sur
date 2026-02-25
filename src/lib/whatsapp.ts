export function normalizeWhatsappNumber(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  const hasPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  if (hasPlus) return digits;

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    digits = `54${digits.slice(1)}`;
  } else if (!digits.startsWith("54")) {
    digits = `54${digits}`;
  }

  return digits;
}

export function buildWhatsAppLink(raw: string | null | undefined, text?: string): string | null {
  const normalized = normalizeWhatsappNumber(raw);
  if (!normalized) return null;

  const base = `https://wa.me/${normalized}`;
  if (!text) return base;

  return `${base}?text=${encodeURIComponent(text)}`;
}
