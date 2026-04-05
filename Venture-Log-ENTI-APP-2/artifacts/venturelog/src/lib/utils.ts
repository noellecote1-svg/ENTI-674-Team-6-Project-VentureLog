/**
 * lib/utils.ts — Utility Functions
 *
 * Shared helper functions used throughout the entire frontend.
 * Currently contains one core utility: the `cn()` function for
 * merging CSS class names cleanly.
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * cn() — Class Name Merger
 *
 * Combines multiple CSS class strings into one, intelligently resolving
 * conflicts between Tailwind utility classes.
 *
 * Uses two libraries working together:
 *   - clsx: handles conditional classes, arrays, and objects
 *     e.g. cn("base", isActive && "active", { hidden: !show })
 *   - tailwind-merge: resolves Tailwind conflicts so later classes win
 *     e.g. cn("p-4", "p-8") → "p-8" (not "p-4 p-8")
 *
 * This is the standard pattern in shadcn/ui component libraries and is
 * used on virtually every component in VentureLog.
 *
 * @example
 *   cn("px-4 py-2", isActive && "bg-primary text-white")
 *   cn("text-sm", variant === "large" && "text-lg")
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
