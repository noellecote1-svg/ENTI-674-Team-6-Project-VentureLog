/**
 * App.tsx — Root Application Component
 *
 * This is the top-level component that wraps the entire VentureLog frontend.
 * It sets up three essential systems that every page in the app depends on:
 *
 *   1. QueryClient — manages all API data fetching, caching, and synchronization
 *   2. TooltipProvider — enables tooltip popups throughout the UI
 *   3. WouterRouter — handles client-side navigation between pages
 *
 * It also defines the complete route map — every URL path and which
 * page component it renders.
 *
 * Architecture note: This file intentionally contains no UI itself.
 * Its only job is wiring together the global providers and the router.
 */

import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import NotFound from "@/pages/not-found";

// Import every page component — one per route
import Home from "@/pages/home";
import JournalList from "@/pages/journal/index";
import JournalEdit from "@/pages/journal/edit";
import MetricsList from "@/pages/metrics/index";
import MetricDetail from "@/pages/metrics/detail";
import DecisionsList from "@/pages/decisions/index";
import DecisionDetail from "@/pages/decisions/detail";
import AiCoach from "@/pages/ai-coach";
import InvestorUpdate from "@/pages/investor-update";

// ─── QUERY CLIENT ─────────────────────────────────────────────────────────────

/**
 * QueryClient configures how React Query fetches and caches API data.
 *
 * - refetchOnWindowFocus: false — prevents automatic re-fetching when the
 *   user switches browser tabs. VentureLog data doesn't change that often,
 *   so this avoids unnecessary API calls.
 *
 * - retry: false — if an API call fails, don't retry it automatically.
 *   The app shows an error state instead, letting the user decide when to retry.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

// ─── ROUTER ───────────────────────────────────────────────────────────────────

/**
 * Router defines every page in the app and what URL shows it.
 * Uses Wouter — a lightweight alternative to React Router.
 *
 * AppLayout wraps all routes so the sidebar and nav bar appear on every page.
 * The last <Route component={NotFound} /> catches any unrecognized URL
 * and shows a 404 page.
 *
 * Route map:
 *   /                        → Home dashboard
 *   /journal                 → Journal entries list
 *   /journal/new             → Create new journal entry
 *   /journal/:id/edit        → Edit existing journal entry
 *   /metrics                 → Metrics list
 *   /metrics/:id             → Single metric detail with chart
 *   /decisions               → Decision log list
 *   /decisions/:id           → Single decision detail with comments
 *   /ai-coach                → AI executive coach chat
 *   /investor-update         → AI investor update generator
 *   (anything else)          → 404 Not Found
 */
function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/journal" component={JournalList} />
        <Route path="/journal/new" component={JournalEdit} />
        <Route path="/journal/:id/edit" component={JournalEdit} />
        <Route path="/metrics" component={MetricsList} />
        <Route path="/metrics/:id" component={MetricDetail} />
        <Route path="/decisions" component={DecisionsList} />
        <Route path="/decisions/:id" component={DecisionDetail} />
        <Route path="/ai-coach" component={AiCoach} />
        <Route path="/investor-update" component={InvestorUpdate} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────

/**
 * App is the root component rendered by main.tsx.
 *
 * Provider hierarchy (outermost to innermost):
 *   QueryClientProvider — makes API data fetching available everywhere
 *   TooltipProvider     — enables tooltip components throughout the UI
 *   WouterRouter        — enables URL-based navigation
 *     Router            — defines all routes (see above)
 *   Toaster             — renders toast notification popups (outside Router
 *                         so notifications can appear from any page)
 *
 * BASE_URL: Wouter is configured with the app's base URL from Vite's
 * environment config, allowing the app to be hosted at a subdirectory path.
 */
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
