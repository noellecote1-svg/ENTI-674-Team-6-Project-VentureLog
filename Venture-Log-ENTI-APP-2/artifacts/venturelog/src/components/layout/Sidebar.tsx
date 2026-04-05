/**
 * components/layout/Sidebar.tsx — Navigation Sidebar
 *
 * The primary navigation component for VentureLog. Renders differently
 * depending on screen size:
 *
 * Desktop (md and above):
 *   - Fixed-width sidebar (256px) on the left edge
 *   - Always visible — no toggle needed
 *   - Shows VentureLog logo at the top
 *   - Navigation links with active state highlighting
 *   - AI Coach credits panel at the bottom
 *
 * Mobile (below md):
 *   - Compact top bar with logo and hamburger menu button
 *   - Clicking hamburger slides in the full sidebar from the left
 *   - Semi-transparent overlay covers the rest of the screen
 *   - Clicking a nav link or the overlay closes the sidebar
 *
 * Active state detection:
 *   Uses Wouter's useLocation() hook to check the current URL path.
 *   A nav item is active if the path exactly matches (for "/") or
 *   starts with the item's href (for all other routes). This ensures
 *   the Journal link stays active on /journal/new and /journal/:id/edit.
 *
 * Design details:
 *   - Active items get a subtle cyan glow effect (neon aesthetic)
 *   - Active icons get a drop-shadow filter for the neon glow
 *   - The VentureLog logo has a cyan text-shadow for the brand identity
 *   - AI Coach credits panel shows remaining usage at the bottom
 */

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { BookOpen, BarChart2, MessageSquare, Lightbulb, TrendingUp, Sparkles, BrainCircuit, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * navItems
 * The ordered list of navigation links shown in the sidebar.
 * Each item maps a display name, URL path, and Lucide icon.
 * Order here determines the visual order in the sidebar.
 */
const navItems = [
  { name: "Home",            href: "/",               icon: BookOpen    },
  { name: "Journal",         href: "/journal",         icon: MessageSquare },
  { name: "Metrics",         href: "/metrics",         icon: BarChart2   },
  { name: "Decision Log",    href: "/decisions",       icon: Lightbulb   },
  { name: "AI Coach",        href: "/ai-coach",        icon: BrainCircuit },
  { name: "Investor Update", href: "/investor-update", icon: TrendingUp  },
];

export function Sidebar() {
  const [location] = useLocation(); // Current URL path from Wouter
  const [isOpen, setIsOpen] = useState(false); // Mobile drawer open/closed state

  return (
    <>
      {/* ── Mobile Top Bar ─────────────────────────────────────────────────
       * Only visible on mobile (hidden on md+).
       * Shows the logo and a hamburger/close button.
       * Sticky so it stays at the top when the page scrolls.
       */}
      <div className="md:hidden flex items-center justify-between p-4 border-b bg-card sticky top-0 z-50">
        <div
          className="text-xl font-bold tracking-tight"
          style={{ color: "hsl(188 100% 50%)", textShadow: "0 0 20px rgba(0,220,255,0.5)" }}
        >
          VentureLog
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          data-testid="button-mobile-menu"
        >
          {/* Toggle between hamburger (closed) and X (open) icons */}
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* ── Mobile Overlay ──────────────────────────────────────────────────
       * Semi-transparent backdrop shown behind the open mobile sidebar.
       * Clicking it closes the sidebar — standard mobile drawer pattern.
       * Only rendered when the mobile drawer is open.
       */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* ── Sidebar Panel ───────────────────────────────────────────────────
       * The actual sidebar content — shared between desktop and mobile.
       *
       * Desktop: sticky, always visible, never translated
       * Mobile: fixed position, slides in/out via translate-x transform
       *   - Closed: -translate-x-full (completely off-screen left)
       *   - Open: translate-x-0 (fully visible)
       */}
      <div className={cn(
        "fixed md:sticky top-0 left-0 h-[100dvh] w-64 border-r flex flex-col shrink-0 z-50 transition-transform duration-200 ease-in-out md:translate-x-0",
        "bg-sidebar border-sidebar-border",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo — desktop only (mobile logo is in the top bar above) */}
        <div className="p-6 hidden md:block">
          <Link href="/">
            <div
              className="text-xl font-bold tracking-tight cursor-pointer"
              style={{ color: "hsl(188 100% 50%)", textShadow: "0 0 20px rgba(0,220,255,0.4)" }}
              data-testid="link-logo"
            >
              VentureLog
            </div>
          </Link>
        </div>

        {/* ── Navigation Links ───────────────────────────────────────────── */}
        <nav className="flex-1 px-3 py-4 md:py-0 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            // Active if: exact match for home ("/"), or path starts with href for others
            // This keeps "Journal" active on /journal/new, "Metrics" on /metrics/:id, etc.
            const isActive = location === item.href ||
              (item.href !== "/" && location.startsWith(item.href));

            return (
              <Link key={item.name} href={item.href}>
                <div
                  onClick={() => setIsOpen(false)} // Close mobile drawer on navigation
                  data-testid={`link-nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all cursor-pointer text-sm font-medium",
                    isActive
                      ? "text-primary bg-primary/10 border border-primary/20" // Active: cyan highlight
                      : "text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent"
                  )}
                  // Subtle inward cyan glow on active items — reinforces the neon theme
                  style={isActive ? { boxShadow: "inset 0 0 20px rgba(0,220,255,0.04), 0 0 8px rgba(0,220,255,0.1)" } : {}}
                >
                  <item.icon
                    className={cn("w-4 h-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")}
                    // Active icons get a cyan drop-shadow for the neon glow effect
                    style={isActive ? { filter: "drop-shadow(0 0 4px rgba(0,220,255,0.6))" } : {}}
                  />
                  {item.name}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* ── AI Coach Credits Panel ─────────────────────────────────────────
         * Pinned to the bottom of the sidebar.
         * Shows remaining AI Coach usage credits.
         * The cyan border and glow reinforce the AI/tech aesthetic.
         * Note: Credit count is currently hardcoded — billing/auth is
         * planned for a future phase (Phase 6).
         */}
        <div className="p-4 border-t border-sidebar-border space-y-3 mt-auto">
          <div
            className="px-3 py-2.5 rounded-md flex items-center justify-between border"
            style={{
              background: "rgba(0,220,255,0.05)",
              borderColor: "rgba(0,220,255,0.2)",
              boxShadow: "0 0 12px rgba(0,220,255,0.05)"
            }}
          >
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Sparkles
                className="w-4 h-4"
                style={{ filter: "drop-shadow(0 0 4px rgba(0,220,255,0.6))" }}
              />
              <span>AI Coach</span>
            </div>
            {/* Credit count badge */}
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground"
              data-testid="text-coach-credits"
            >
              15
            </span>
          </div>
          <p className="text-xs text-muted-foreground px-1">15 coach credits remaining</p>
        </div>
      </div>
    </>
  );
}
