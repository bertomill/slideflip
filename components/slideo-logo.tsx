"use client";

import * as React from "react";
import Image from "next/image";
import { useTheme } from "next-themes";

type SlideoLogoProps = {
  className?: string;
  size?: number;
};

export function SlideoLogo({ className, size = 40 }: SlideoLogoProps) {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return a neutral logo during hydration
    return (
      <div 
        className={className}
        style={{ width: size, height: size }}
        aria-label="SlideFlip logo"
      />
    );
  }

  const isDark = resolvedTheme === 'dark';
  const logoSrc = isDark ? '/slideo-logo-white.svg' : '/slideo-logo-black.svg';

  return (
    <Image
      src={logoSrc}
      alt="SlideFlip logo"
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}

export default SlideoLogo;

