import { InfoBadge } from "@/components/common/VisualSystem";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getOperationalPrice } from "@/features/pricing/operational-price";
import type { PriceRoundingConfig } from "@/features/pricing/rounding";
import { cn } from "@/lib/utils";

type OperationalPriceDisplayProps = {
  value: number | null | undefined;
  config: PriceRoundingConfig | null | undefined;
  formatValue: (value: number) => string;
  className?: string;
  valueClassName?: string;
  originalClassName?: string;
  showOriginal?: boolean;
};

export function OperationalPriceDisplay({
  value,
  config,
  formatValue,
  className,
  valueClassName,
  originalClassName,
  showOriginal = true,
}: OperationalPriceDisplayProps) {
  const { originalPrice, operationalPrice, wasRounded } = getOperationalPrice(value, config);

  if (typeof operationalPrice !== "number" || !Number.isFinite(operationalPrice)) {
    return <span className={valueClassName}>-</span>;
  }

  const originalText = typeof originalPrice === "number" && Number.isFinite(originalPrice)
    ? formatValue(originalPrice)
    : null;
  const roundedFromLabel = originalText ? `Redondeado desde ${originalText}` : "Redondeado";

  return (
    <div className={cn("flex min-w-0 flex-col items-end gap-0.5", className)}>
      <span className={valueClassName}>{formatValue(operationalPrice)}</span>
      {wasRounded ? (
        <div className="flex max-w-full flex-wrap justify-end gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                aria-label={roundedFromLabel}
              >
                <InfoBadge className="cursor-default">
                  Redondeado
                </InfoBadge>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {roundedFromLabel}
            </TooltipContent>
          </Tooltip>
          {showOriginal && originalText ? (
            <span className={cn("truncate text-[10px] text-muted-foreground", originalClassName)}>
              Original {originalText}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
