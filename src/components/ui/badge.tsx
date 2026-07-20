import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex min-h-6 max-w-full shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold tracking-[0.025em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-primary/12 bg-primary/10 text-primary",
        secondary: "border-border/70 bg-muted/55 text-foreground",
        destructive: "border-destructive/14 bg-destructive/10 text-destructive",
        outline: "border-border/70 bg-background/72 text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge };
