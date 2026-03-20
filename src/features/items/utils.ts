import { cleanText } from "@/lib/clean";

export function generateItemSku(name: string) {
  const base = cleanText(name)
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 12);
  const suffix = Date.now().toString().slice(-4);
  return `${base || "ITEM"}-${suffix}`;
}
