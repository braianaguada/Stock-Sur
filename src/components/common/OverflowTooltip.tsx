import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type OverflowTooltipProps = {
  text: string | null | undefined;
  className?: string;
};

export function OverflowTooltip({ text, className }: OverflowTooltipProps) {
  const safeText = text?.trim() || "-";

  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        <span className={className} title={safeText}>
          {safeText}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm whitespace-normal break-words">
        {safeText}
      </TooltipContent>
    </Tooltip>
  );
}
