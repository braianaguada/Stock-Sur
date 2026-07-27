import { StatusBadge } from "@/components/common/VisualSystem";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type StockBadgeProps = {
  total: number | undefined;
};

export function StockBadge({ total }: StockBadgeProps) {
  if (total === undefined) {
    return <StatusBadge tone="muted">S/D</StatusBadge>;
  }

  if (total <= 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex" tabIndex={0}>
            <StatusBadge tone="danger">Sin stock</StatusBadge>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Stock actual: 0
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex" tabIndex={0}>
          <StatusBadge tone="success">
            {total.toLocaleString("es-AR", { maximumFractionDigits: 1 })}
          </StatusBadge>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        Stock actual: {total}
      </TooltipContent>
    </Tooltip>
  );
}
