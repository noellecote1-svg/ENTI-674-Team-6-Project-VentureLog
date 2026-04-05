/**
 * components/ui/textarea.tsx — Textarea Component (shadcn/ui)
 *
 * A multi-line text input used throughout VentureLog for:
 *   - Decision context summary field
 *   - Decision expected/actual outcome fields
 *   - Comment input in the decision detail page
 *   - Additional context in the investor update form
 * Styled to match the dark theme with the same border and focus
 * ring as the Input component.
 *
 * Exports: Textarea
 */
import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
