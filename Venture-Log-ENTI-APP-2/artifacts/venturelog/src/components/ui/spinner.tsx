/**
 * components/ui/spinner.tsx — Spinner Component
 *
 * A simple animated loading spinner using the Loader2 icon from Lucide.
 * Includes proper accessibility attributes (role="status", aria-label).
 * Used as a lightweight loading indicator throughout VentureLog wherever
 * a full skeleton placeholder is not needed.
 *
 * Exports: Spinner
 */
import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
