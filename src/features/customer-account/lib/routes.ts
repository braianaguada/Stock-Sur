export function customerAccountPath(customerId?: string | null) {
  if (!customerId) return "/customer-account";
  return `/customer-account?customerId=${encodeURIComponent(customerId)}`;
}

export function customerIdFromAccountParams(params: URLSearchParams) {
  return params.get("customerId") ?? params.get("customer_id") ?? "all";
}
