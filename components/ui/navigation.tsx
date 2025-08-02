"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface NavigationProps extends React.HTMLAttributes<HTMLElement> {
  variant?: "default" | "glass" | "premium";
}

const Navigation = React.forwardRef<HTMLElement, NavigationProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    return (
      <nav
        ref={ref}
        className={cn(
          "flex items-center justify-between p-4 transition-premium",
          {
            "bg-background border-b border-border": variant === "default",
            "glass border-b border-border/50": variant === "glass",
            "bg-gradient-to-r from-background via-background/95 to-background border-b border-primary/20": variant === "premium",
          },
          className
        )}
        {...props}
      >
        {children}
      </nav>
    );
  }
);
Navigation.displayName = "Navigation";

const NavigationBrand = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center space-x-2 font-bold text-lg", className)}
    {...props}
  />
));
NavigationBrand.displayName = "NavigationBrand";

const NavigationMenu = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center space-x-6", className)}
    {...props}
  />
));
NavigationMenu.displayName = "NavigationMenu";

const NavigationItem = React.forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    active?: boolean;
  }
>(({ className, active, ...props }, ref) => (
  <a
    ref={ref}
    className={cn(
      "text-sm font-medium transition-premium hover:text-primary relative group",
      active && "text-primary",
      className
    )}
    {...props}
  >
    {props.children}
    <span className={cn(
      "absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full",
      active && "w-full"
    )} />
  </a>
));
NavigationItem.displayName = "NavigationItem";

export { Navigation, NavigationBrand, NavigationMenu, NavigationItem };