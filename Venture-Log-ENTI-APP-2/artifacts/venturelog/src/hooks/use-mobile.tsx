/**
 * hooks/use-mobile.tsx — Mobile Detection Hook
 *
 * A React hook that detects whether the current screen width is
 * below the mobile breakpoint (768px). Used throughout the app
 * to conditionally render mobile vs desktop UI variants.
 *
 * Uses the browser's MediaQueryList API which is more reliable than
 * simply checking window.innerWidth on mount — it correctly responds
 * to window resize events and device orientation changes in real time.
 *
 * Usage:
 *   const isMobile = useIsMobile()
 *   if (isMobile) return <MobileView />
 *   return <DesktopView />
 */

import * as React from "react"

// The pixel width at which the app switches from mobile to desktop layout.
// Matches Tailwind's "md" breakpoint (768px).
const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Start as undefined to avoid hydration mismatches on server-side rendering
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    // Create a media query that matches screens narrower than the breakpoint
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)

    // Handler that updates state whenever the screen crosses the breakpoint
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }

    // Listen for future breakpoint crossings (resize, orientation change)
    mql.addEventListener("change", onChange)

    // Set the initial value immediately on mount
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)

    // Cleanup: remove the listener when the component unmounts
    return () => mql.removeEventListener("change", onChange)
  }, []) // Empty deps array — only runs once on mount

  // Convert undefined → false using !! so callers always get a boolean
  return !!isMobile
}
