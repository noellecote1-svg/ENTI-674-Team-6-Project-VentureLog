/**
 * components/layout/AppLayout.tsx — App Shell Layout
 *
 * The outermost layout wrapper for every page in VentureLog.
 * Wraps all route content with the Sidebar so that navigation
 * is always visible regardless of which page the founder is on.
 *
 * Layout structure:
 *   - Full viewport height (100dvh) — uses dvh (dynamic viewport height)
 *     instead of vh to correctly handle mobile browser chrome
 *   - Desktop: Sidebar on left (fixed width) + main content on right (flex-1)
 *   - Mobile: Sidebar becomes a top bar + slide-out drawer (handled in Sidebar.tsx)
 *
 * Used in App.tsx — wraps the entire <Switch> router so every
 * page automatically gets the sidebar without needing to include it
 * in each page component individually.
 */

import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-[100dvh] bg-background flex flex-col md:flex-row w-full overflow-hidden">
      {/* Navigation sidebar — always visible, collapses to top bar on mobile */}
      <Sidebar />

      {/* Main content area — scrollable, takes up all remaining space */}
      <main className="flex-1 w-full overflow-y-auto relative">
        {children}
      </main>
    </div>
  );
}
