import { useState } from "react";
import { Link, useLocation } from "wouter";
import { BookOpen, BarChart2, MessageSquare, Lightbulb, TrendingUp, Sparkles, BrainCircuit, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { name: "Home", href: "/", icon: BookOpen },
  { name: "Journal", href: "/journal", icon: MessageSquare },
  { name: "Metrics", href: "/metrics", icon: BarChart2 },
  { name: "Decision Log", href: "/decisions", icon: Lightbulb },
  { name: "AI Coach", href: "/ai-coach", icon: BrainCircuit },
  { name: "Investor Update", href: "/investor-update", icon: TrendingUp },
];

export function Sidebar() {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 border-b bg-card sticky top-0 z-50">
        <div className="text-xl font-bold tracking-tight" style={{ color: "hsl(188 100% 50%)", textShadow: "0 0 20px rgba(0,220,255,0.5)" }}>
          VentureLog
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(!isOpen)} data-testid="button-mobile-menu">
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Sidebar Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Content */}
      <div className={cn(
        "fixed md:sticky top-0 left-0 h-[100dvh] w-64 border-r flex flex-col shrink-0 z-50 transition-transform duration-200 ease-in-out md:translate-x-0",
        "bg-sidebar border-sidebar-border",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
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

        <nav className="flex-1 px-3 py-4 md:py-0 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.name} href={item.href}>
                <div
                  onClick={() => setIsOpen(false)}
                  data-testid={`link-nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all cursor-pointer text-sm font-medium",
                    isActive
                      ? "text-primary bg-primary/10 border border-primary/20"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent"
                  )}
                  style={isActive ? { boxShadow: "inset 0 0 20px rgba(0,220,255,0.04), 0 0 8px rgba(0,220,255,0.1)" } : {}}
                >
                  <item.icon
                    className={cn("w-4 h-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")}
                    style={isActive ? { filter: "drop-shadow(0 0 4px rgba(0,220,255,0.6))" } : {}}
                  />
                  {item.name}
                </div>
              </Link>
            );
          })}
        </nav>

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
              <Sparkles className="w-4 h-4" style={{ filter: "drop-shadow(0 0 4px rgba(0,220,255,0.6))" }} />
              <span>AI Coach</span>
            </div>
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
