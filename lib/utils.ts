import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function for combining and merging CSS class names
 * Combines clsx for conditional classes with tailwind-merge to resolve conflicts
 * @param inputs - Array of class values (strings, objects, arrays, etc.)
 * @returns Merged and deduplicated class string optimized for Tailwind CSS
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Environment variable validation for Supabase configuration
 * Checks if required Supabase environment variables are present
 * Used to verify proper setup before attempting database connections
 * Note: This check can be removed after initial setup - it's for tutorial purposes
 */
export const hasEnvVars =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
