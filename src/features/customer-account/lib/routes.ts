export function customerAccountPath(customerId?: string | null) {
  if (!customerId) return "/customer-account";
  return `/customer-account?customerId=${encodeURIComponent(customerId)}`;
}
