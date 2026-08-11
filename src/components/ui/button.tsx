import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)] text-sm font-semibold ring-offset-background transition-[background-color,color,border-color,box-shadow,opacity] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[var(--shadow-xs)] hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-[var(--shadow-xs)] hover:bg-destructive/90",
        outline: "border border-input/75 bg-background text-foreground shadow-[var(--shadow-xs)] hover:bg-accent/78 hover:text-accent-foreground",
        secondary: "border border-secondary/35 bg-secondary text-secondary-foreground shadow-[var(--shadow-xs)] hover:bg-secondary/88",
        ghost: "text-muted-foreground hover:bg-accent/72 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2.5",
        sm: "h-9 rounded-[calc(var(--radius-xs)+2px)] px-3 text-xs",
        lg: "h-12 rounded-[calc(var(--radius-sm)+4px)] px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
