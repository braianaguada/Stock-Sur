import type { CatalogLine, Supplier } from "./types";

export type DisplayCurrency = "ARS" | "USD";
export function supplierMoney(value: number | null | undefined, currency: string) {
  return value == null ? "—" : `${currency} ${value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export function convertSupplierPrice(value: number, from: DisplayCurrency, to: DisplayCurrency, rate?: number): number | null {
  if (!Number.isFinite(value)) return null;
  if (from === to) return value;
  if (!rate || !Number.isFinite(rate) || rate <= 0) return null;
  return from === "USD" ? value * rate : value / rate;
}

export function supplierPriceBreakdown(line: CatalogLine, supplier: Supplier, currency: DisplayCurrency, rate?: number) {
  if (line.tax_treatment === "UNKNOWN") return null;
  const original = Number(line.cost);
  if (!Number.isFinite(original) || original <= 0) return null;
  const vatRate = Number(supplier.vat_rate ?? 21);
  const freightRate = Number(supplier.freight_rate ?? 0);
  const base = line.tax_treatment === "INCLUDED" ? original / (1 + vatRate / 100) : original;
  const net = convertSupplierPrice(base, line.currency, currency, rate);
  if (net === null) return null;
  const vat = net * vatRate / 100;
  const freight = net * freightRate / 100;
  return { net, vat, freight, taxed: net + vat, total: net + vat + freight };
}

export interface SupplierCartItem {
  supplierId: string;
  versionId: string;
  listName: string;
  line: CatalogLine;
  quantity: number;
}

export function addSupplierCartItem(items: SupplierCartItem[], item: SupplierCartItem): SupplierCartItem[] {
  const found = items.find((entry) => entry.line.id === item.line.id && entry.supplierId === item.supplierId);
  return found ? items.map((entry) => entry === found ? { ...entry, quantity: entry.quantity + item.quantity } : entry) : [...items, item];
}

export function supplierOrderAmounts(net: number, vat = 0, freight = 0) {
  return { net, vat: net * vat / 100, freight: net * freight / 100, total: net * (1 + vat / 100 + freight / 100) };
}
