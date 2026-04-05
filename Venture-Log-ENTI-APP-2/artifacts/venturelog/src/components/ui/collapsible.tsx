/**
 * components/ui/collapsible.tsx — Collapsible Component (shadcn/ui)
 *
 * A simple show/hide container that can be toggled open or closed.
 * Lighter than Accordion — use when you need a single collapsible
 * section without the accordion's exclusive open behavior.
 *
 * Exports: Collapsible, CollapsibleTrigger, CollapsibleContent
 */
"use client"

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"

const Collapsible = CollapsiblePrimitive.Root

const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger

const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
