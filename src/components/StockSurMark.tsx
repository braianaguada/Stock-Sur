import { cn } from "@/lib/utils";

type StockSurMarkProps = {
  className?: string;
  title?: string;
};

export function StockSurMark({ className, title = "Stock Sur" }: StockSurMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      className={cn("shrink-0", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="2" y="2" width="60" height="60" rx="17" fill="#1D4ED8" />
      <path d="M32 10 50 20 32 30 14 20 32 10Z" fill="#FFFFFF" fillOpacity=".96" />
      <path d="M14 20 32 30v22L14 42V20Z" fill="#EFF6FF" />
      <path d="M50 20 32 30v22l18-10V20Z" fill="#BFDBFE" />
      <path d="M32 30 14 20m18 10 18-10M32 30v22" fill="none" stroke="#1E3A8A" strokeOpacity=".32" strokeWidth="2" />
      <path d="m25 39 5 5 10-11" fill="none" stroke="#0F766E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
