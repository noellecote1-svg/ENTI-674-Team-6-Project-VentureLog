/**
 * components/ui/skeleton.tsx — Skeleton Loader Component (shadcn/ui)
 *
 * An animated placeholder shown while content is loading.
 * Uses a pulsing opacity animation over a muted background to indicate
 * that real content is on its way. Used on the home dashboard, journal
 * list, and metrics list while API data is fetching.
 *
 * Exports: Skeleton
 */
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-primary/10", className)}
      {...props}
    />
  )
}

export { Skeleton }
