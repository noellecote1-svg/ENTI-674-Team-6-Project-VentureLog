/**
 * lib/constants.ts — Shared Application Constants
 *
 * Defines the fixed values used consistently across the entire frontend.
 * Centralizing these here means changing a tag name or color only
 * requires editing one file rather than hunting through every component.
 *
 * These constants are imported by:
 *   - Journal list and editor (tag badges + filtering)
 *   - Decision log list and detail (tag badges + filtering)
 *   - Dashboard (recent decision tag display)
 */

/**
 * TAG_COLORS
 * Maps each of the 7 journal/decision tags to a Tailwind CSS class string.
 * Each tag has a unique dark-mode-friendly color scheme:
 *   - Background: very dark tinted color at 60% opacity
 *   - Text: light version of the same color
 *   - Border: medium version of the same color at 50% opacity
 *
 * Color choices by tag:
 *   Product     → Indigo   (strategic/technical feel)
 *   Growth      → Emerald  (positive momentum)
 *   Team        → Orange   (people/energy)
 *   Fundraising → Cyan     (matches primary brand color)
 *   Operations  → Slate    (neutral/process)
 *   Finance     → Teal     (money/stability)
 *   Reflection  → Rose     (introspective/personal)
 */
export const TAG_COLORS: Record<string, string> = {
  Product:     "bg-indigo-950/60 text-indigo-300 border-indigo-700/50",
  Growth:      "bg-emerald-950/60 text-emerald-300 border-emerald-700/50",
  Team:        "bg-orange-950/60 text-orange-300 border-orange-700/50",
  Fundraising: "bg-cyan-950/60 text-cyan-300 border-cyan-700/50",
  Operations:  "bg-slate-800/60 text-slate-300 border-slate-600/50",
  Finance:     "bg-teal-950/60 text-teal-300 border-teal-700/50",
  Reflection:  "bg-rose-950/60 text-rose-300 border-rose-700/50",
};

/**
 * ALL_TAGS
 * The complete ordered list of valid tags for journal entries and decisions.
 * These 7 tags are fixed by the product spec — founders cannot create
 * custom tags. Using "as const" makes TypeScript treat each value as
 * a literal string type rather than just "string", enabling strict
 * type checking when tags are used as API parameters.
 *
 * This same list is used in:
 *   - Backend validation (VALID_TAGS in route handlers)
 *   - Frontend tag filter UI
 *   - Tag selection badges in the editor
 *   - API schema (JournalTag enum)
 */
export const ALL_TAGS = [
  "Product",
  "Growth",
  "Team",
  "Fundraising",
  "Operations",
  "Finance",
  "Reflection",
] as const;
