import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex min-h-11 items-end justify-center gap-1 border-b border-border/70 bg-transparent px-1 text-muted-foreground",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-[var(--radius-xs)] px-3.5 py-2 text-sm font-medium ring-offset-background transition-colors duration-200 hover:bg-accent/60 hover:text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-[hsl(var(--domain-accent))] after:opacity-0 data-[state=active]:bg-[hsl(var(--domain-accent))]/[.07] data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:after:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-3 data-[state=inactive]:hidden data-[state=active]:animate-in data-[state=active]:fade-in-50 data-[state=active]:slide-in-from-bottom-1 duration-200 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))] focus-visible:ring-offset-2 motion-reduce:animate-none",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
