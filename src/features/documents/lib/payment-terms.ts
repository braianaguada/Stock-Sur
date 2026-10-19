export function customerPaymentTerms(customer?: { account_due_days?: number | null } | null) {
  const days = Math.max(0, customer?.account_due_days ?? 0);
  return days === 0 ? "Contado" : `${days} días`;
}
