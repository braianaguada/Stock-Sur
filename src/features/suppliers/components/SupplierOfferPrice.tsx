import { cn } from "@/lib/utils";

function formatSupplierPrice(value: number, currency: "ARS" | "USD") {
  return `${currency} ${value.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function SupplierOfferPrice({
  value,
  currency,
  className,
}: {
  value: number;
  currency: "ARS" | "USD";
  className?: string;
}) {
  return (
    <span className={cn("whitespace-nowrap text-right font-semibold tabular-nums", className)}>
      {formatSupplierPrice(value, currency)}
    </span>
  );
}
