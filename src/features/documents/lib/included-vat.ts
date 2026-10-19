/** Commercial unit prices are final prices, including 21% VAT. */
export function splitDocumentIncludedVat(total: number) {
  const roundedTotal = Math.round((total + Number.EPSILON) * 100) / 100;
  const subtotal = Math.round((roundedTotal / 1.21 + Number.EPSILON) * 100) / 100;
  return {
    subtotal,
    tax_total: Math.round((roundedTotal - subtotal) * 100) / 100,
    total: roundedTotal,
  };
}
