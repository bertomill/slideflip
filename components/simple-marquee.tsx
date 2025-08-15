"use client";

import { cn } from "@/lib/utils";

interface SimpleMarqueeProps {
  children: React.ReactNode;
  reverse?: boolean;
  speed?: "slow" | "medium";
  pauseOnHover?: boolean;
  className?: string;
}

export function SimpleMarquee({
  children,
  reverse = false,
  speed = "slow",
  pauseOnHover = false,
  className,
}: SimpleMarqueeProps) {
  const animationClass = reverse
    ? speed === "slow"
      ? "animate-marquee-reverse-slow"
      : "animate-marquee-reverse-medium"
    : speed === "slow"
    ? "animate-marquee-slow"
    : "animate-marquee-medium";

  return (
    <div
      className={cn(
        "flex overflow-hidden",
        pauseOnHover && "marquee-pause",
        className
      )}
    >
      <div className={cn("flex shrink-0 gap-4", animationClass)}>
        {children}
      </div>
      <div className={cn("flex shrink-0 gap-4", animationClass)}>
        {children}
      </div>
      <div className={cn("flex shrink-0 gap-4", animationClass)}>
        {children}
      </div>
      <div className={cn("flex shrink-0 gap-4", animationClass)}>
        {children}
      </div>
    </div>
  );
}
