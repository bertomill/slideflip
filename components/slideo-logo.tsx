"use client";

import * as React from "react";

type SlideoLogoProps = {
  className?: string;
};

export function SlideoLogo({ className }: SlideoLogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label="Slideo logo"
      className={className}
    >
      <defs>
        <linearGradient id="slideo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(var(--manatee))" />
          <stop offset="100%" stopColor="hsl(var(--pale-sky))" />
        </linearGradient>
      </defs>

      {/* Slide canvas */}
      <rect
        x="3"
        y="4"
        width="18"
        height="14"
        rx="3"
        fill="url(#slideo-g)"
        stroke="hsl(var(--border))"
        strokeWidth="1"
      />

      {/* Text lines */}
      <rect x="6" y="7" width="9" height="1.6" rx="0.8" fill="hsl(var(--background))" opacity="0.85" />
      <rect x="6" y="10" width="12" height="1.6" rx="0.8" fill="hsl(var(--background))" opacity="0.85" />
      <rect x="6" y="13" width="7" height="1.6" rx="0.8" fill="hsl(var(--background))" opacity="0.85" />

      {/* Sparkle to suggest AI/magic */}
      <path
        d="M18 6.5l.6 1.2 1.2.6-1.2.6-.6 1.2-.6-1.2-1.2-.6 1.2-.6z"
        fill="hsl(var(--old-lavender))"
        opacity="0.95"
      />
    </svg>
  );
}

export default SlideoLogo;

